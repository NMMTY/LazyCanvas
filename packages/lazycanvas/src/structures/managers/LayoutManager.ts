import {
  type AnyLayer,
  type ICanvas,
  type ICanvasRenderingContext2D,
  LayerType,
} from "../../types";
import {
  LazyLog,
  authoredProp,
  captureAuthoredProps,
  getChildren,
  isVerticalDirection,
  restoreAuthoredProps,
  treeVersion,
  walkLayers,
} from "../../utils";
import { Group, type Text } from "../components";

// Define minimal types for Yoga to avoid import issues
type YogaNode = any;
type Yoga = any;

/** Whether two plain values are the same: numbers and strings by value, arrays and plain objects by content. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (!(key in right) || !sameValue(left[key], right[key])) return false;
  }
  return true;
}

/** A copy of plain data that later changes to the original cannot reach. */
function copyValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copyValue) as T;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const copy: Record<string, unknown> = {};
  for (const key in value) copy[key] = copyValue((value as Record<string, unknown>)[key]);
  return copy as T;
}

/**
 * What one layer of the flow looked like when the layout was last worked out: everything the result
 * depends on, and what was written to the layer as the result.
 */
interface LayoutRecord {
  layer: AnyLayer | Group;
  /** `props.layout` at the time: the flex rules of the layer. */
  layout: unknown;
  /** For text: the size the text measures, which is what the layout engine is given for it. */
  text?: { width: number; height: number };
  /** The values the pass wrote, to tell whether anything has written over them since. */
  position: unknown;
  x: number;
  y: number;
  size: unknown;
  width: number;
  height: number;
  centring: unknown;
  children: LayoutRecord[];
}

interface LayoutMemo {
  width: number;
  height: number;
  version: number;
  record: LayoutRecord;
}

export class LayoutManager {
  private yoga: Yoga | null = null;
  private debug: boolean;
  public ready: Promise<void>;

  /**
   * Skip the layout pass when nothing it depends on has changed since the last one. On by default; turn it off
   * to get a full pass on every frame, which gives the same result.
   */
  public reuse = true;

  /** How many layout passes ran and how many were skipped. */
  public readonly stats = { passes: 0, skipped: 0 };

  private memo = new WeakMap<object, LayoutMemo>();

  constructor(opts?: { debug?: boolean }) {
    this.debug = opts?.debug || false;
    this.ready = this.init();
  }

  private async init() {
    try {
      const mod = await import("yoga-layout");

      this.yoga = mod.default || mod;

      for (const [key, value] of Object.entries(mod)) {
        if (key !== "default" && !(key in this.yoga)) {
          (this.yoga as any)[key] = value;
        }
      }

      if (this.debug) {
        console.log("Yoga Layout initialized successfully via Base64");
      }
    } catch (e) {
      console.error("Failed to initialize Yoga Layout:", e);
    }
  }

  /**
   * Children that take part in the Yoga pass.
   *
   * A leaf with an explicit `position` and no `layout` is positioned by hand,
   * so it is left out of the flex flow entirely. `createNode` and `applyLayout`
   * must agree on this exactly, which is why both call this one function.
   */
  private layoutChildren(layer: AnyLayer | Group): Array<AnyLayer | Group> {
    return getChildren(layer).filter((child) => {
      const isContainer = child instanceof Group || child.type === LayerType.Group;
      if (isContainer) return true;

      // Read `position` as the caller wrote it: a previous pass may have
      // written computed offsets there, which would make every laid-out child
      // look manually positioned from the second frame onwards.
      const position = authoredProp(child, "position");
      const hasExplicitPosition =
        position && (position.x !== undefined || position.y !== undefined);
      const childLayout = (child.props as any)?.layout;
      const hasExplicitLayout = childLayout !== undefined && Object.keys(childLayout).length > 0;

      return !(hasExplicitPosition && !hasExplicitLayout);
    });
  }

  /**
   * Computes the flexbox layout for a tree and writes the result into the
   * layers so the render pipeline can draw them.
   *
   * Does nothing while yoga-layout is still loading; the next frame picks it up.
   *
   * @param {AnyLayer | Group} [root] - Root of the tree to lay out.
   * @param {number} [width] - Available width.
   * @param {number} [height] - Available height.
   * @param {ICanvasRenderingContext2D} [ctx] - Context used to measure text.
   * @param {ICanvas} [canvas] - Canvas used to measure text.
   */
  public calculateLayout(
    root: AnyLayer | Group,
    width: number,
    height: number,
    ctx?: ICanvasRenderingContext2D,
    canvas?: ICanvas,
  ) {
    if (!this.yoga) {
      if (this.debug) LazyLog.log("warn", "LayoutManager: Yoga not initialized yet");
      return;
    }

    // Building the tree for the layout engine, running it and copying the result back is most of what this
    // costs, and a scene whose layout does not change (or only moves hand-placed layers) asks for the same
    // answer on every frame. The last answer is kept, and used again while its inputs are what they were and
    // nobody has written over it.
    const memo = this.reuse ? this.memo.get(root) : undefined;
    if (
      memo &&
      memo.width === width &&
      memo.height === height &&
      memo.version === treeVersion() &&
      this.unchanged(memo.record, ctx, canvas)
    ) {
      this.stats.skipped++;
      return;
    }

    // Remember the caller's input before the first pass overwrites it.
    for (const layer of walkLayers(root)) {
      captureAuthoredProps(layer);
    }

    const rootNode = this.createNode(root, ctx, canvas);
    if (!rootNode) return;

    rootNode.setWidth(width);
    rootNode.setHeight(height);
    rootNode.calculateLayout(width, height, this.yoga.DIRECTION_LTR);

    const record = this.applyLayout(rootNode, root, ctx, canvas);

    this.freeNode(rootNode);
    this.stats.passes++;
    if (this.reuse) this.memo.set(root, { width, height, version: treeVersion(), record });
  }

  /**
   * Whether running the layout again would change nothing: the layers in the flow are the ones that were laid
   * out, their rules and the size of their text are as they were, and what the last pass wrote is still there.
   */
  private unchanged(
    record: LayoutRecord,
    ctx?: ICanvasRenderingContext2D,
    canvas?: ICanvas,
  ): boolean {
    const layer = record.layer;
    const props = layer.props as any;
    if (!props) return false;

    if (!sameValue(record.layout, props.layout)) return false;

    // What an animation or other code wrote over the result since (a signal on a laid-out layer does)
    // has to be put back, which only a pass does.
    if (props.position !== record.position || props.size !== record.size) return false;
    if (props.centring !== record.centring || props._computedLayout !== true) return false;
    if (record.position && (props.position.x !== record.x || props.position.y !== record.y)) {
      return false;
    }
    if (record.size && (props.size.width !== record.width || props.size.height !== record.height)) {
      return false;
    }

    if (record.text) {
      if (!ctx || !canvas) return false;
      const size = this.measureTextLayer(layer as Text, ctx, canvas);
      if (size.width !== record.text.width || size.height !== record.text.height) return false;
    }

    const children = this.layoutChildren(layer);
    if (children.length !== record.children.length) return false;
    for (let i = 0; i < children.length; i++) {
      if (children[i] !== record.children[i].layer) return false;
      if (!this.unchanged(record.children[i], ctx, canvas)) return false;
    }
    return true;
  }

  /**
   * The size a text layer gives the layout engine: its natural size, on one line, as laid out from the top left.
   *
   * The props that are relaxed for the measurement are put back as they were, in place, so that the objects
   * the layer holds are the same ones afterwards.
   */
  private measureTextLayer(
    textLayer: Text,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
  ): { width: number; height: number } {
    const props = textLayer.props;
    const originalAlign = props.align;
    const originalBaseline = props.baseline;
    const size = props.size as { width?: unknown } | undefined;
    const originalWidth = size?.width;
    const multiline = props.multiline;
    const originalEnabled = multiline?.enabled;

    // Yoga expects top-left coordinates.
    props.align = "left";
    props.baseline = "top";

    // Vertical text flows down a column and wraps sideways, so its
    // constrained axis is the height and its free axis is the width. The
    // relaxations below are the other way round, and applying them would
    // measure an unwrapped column while `draw` wraps it — the node would be
    // sized for text that is never drawn that way.
    const vertical = isVerticalDirection(props.direction);

    try {
      if (!vertical) {
        // Measure the natural size: no wrapping, no width to wrap to.
        if (multiline) multiline.enabled = false;
        if (size) size.width = undefined;
      }

      const measured = textLayer.measureText(ctx, canvas);
      return { width: Math.ceil(measured.width), height: Math.ceil(measured.height) };
    } finally {
      if (size) size.width = originalWidth;
      if (multiline) multiline.enabled = originalEnabled as boolean;
      props.align = originalAlign;
      props.baseline = originalBaseline;
    }
  }

  private createNode(
    layer: AnyLayer | Group,
    ctx?: ICanvasRenderingContext2D,
    canvas?: ICanvas,
  ): YogaNode | null {
    if (!this.yoga) return null;

    // This layer takes part in the flow, so its geometry is about to be
    // overwritten: start from the authored values rather than from the previous
    // frame's output. Layers outside the flow are never touched, which is what
    // keeps a signal-driven position animating.
    restoreAuthoredProps(layer);

    const node = this.yoga.Node.create();
    const layout = (layer.props as any)?.layout || {};
    const size = (layer.props as any)?.size || {};

    // Apply explicit layout properties first
    if (layout.width !== undefined) {
      this.setDimension(node, "width", layout.width);
    } else if (size.width !== undefined && layer.type !== LayerType.Text) {
      // For Text, skip size.width to allow measureFunc to work
      this.setDimension(node, "width", size.width);
    } else if ((layer instanceof Group || layer.type === "group") && !layout.flexDirection) {
      // For Group without explicit width and not a flex container, stretch to parent
      // Flex containers should shrink-wrap their content by default
      node.setWidthPercent(100);
    }

    if (layout.height !== undefined) {
      this.setDimension(node, "height", layout.height);
    } else if (size.height !== undefined && layer.type !== LayerType.Text) {
      // For Text, skip size.height to allow measureFunc to work
      this.setDimension(node, "height", size.height);
    } else if ((layer instanceof Group || layer.type === "group") && !layout.flexDirection) {
      // For Group without explicit height and not a flex container, stretch to parent
      // Flex containers should shrink-wrap their content by default
      node.setHeightPercent(100);
    }

    if (layout.flexDirection) node.setFlexDirection(this.getFlexDirection(layout.flexDirection));
    if (layout.justifyContent)
      node.setJustifyContent(this.getJustifyContent(layout.justifyContent));
    if (layout.alignItems) node.setAlignItems(this.getAlignItems(layout.alignItems));

    if (layout.flexGrow !== undefined) node.setFlexGrow(layout.flexGrow);
    if (layout.flexShrink !== undefined) node.setFlexShrink(layout.flexShrink);
    if (layout.flexBasis !== undefined) node.setFlexBasis(layout.flexBasis);

    if (layout.padding) this.setPadding(node, layout.padding);
    if (layout.margin) this.setMargin(node, layout.margin);
    if (layout.gap !== undefined) node.setGap(this.yoga.GUTTER_ALL, layout.gap);

    // Position type (relative/absolute)
    const isAbsolute = layout.position === "absolute";
    if (isAbsolute) {
      node.setPositionType(this.yoga.POSITION_TYPE_ABSOLUTE);

      // Position values (top, left, right, bottom) - only for absolute positioning
      if (layout.top !== undefined) node.setPosition(this.yoga.EDGE_TOP, layout.top);
      if (layout.left !== undefined) node.setPosition(this.yoga.EDGE_LEFT, layout.left);
      if (layout.right !== undefined) node.setPosition(this.yoga.EDGE_RIGHT, layout.right);
      if (layout.bottom !== undefined) node.setPosition(this.yoga.EDGE_BOTTOM, layout.bottom);
    }
    // If not absolute, ignore top/left/right/bottom as they break flexbox layout

    // Handle Text measurement
    if (layer.type === LayerType.Text && ctx && canvas) {
      node.setMeasureFunc(() => this.measureTextLayer(layer as Text, ctx, canvas));
    }

    this.layoutChildren(layer).forEach((child, index) => {
      const childNode = this.createNode(child, ctx, canvas);
      if (childNode) node.insertChild(childNode, index);
    });

    return node;
  }

  /**
   * Copies Yoga's computed geometry onto the layers.
   *
   * Positions are relative to the parent, which matches how the render pipeline
   * translates the context when descending into a subtree.
   */
  private applyLayout(
    node: YogaNode,
    layer: AnyLayer | Group,
    ctx?: ICanvasRenderingContext2D,
    canvas?: ICanvas,
  ): LayoutRecord {
    const layout = node.getComputedLayout();

    if (this.debug) {
      LazyLog.log(
        "info",
        `[Layout] ${layer.id}: left=${layout.left}, top=${layout.top}, width=${layout.width}, height=${layout.height}`,
      );
    }

    if (!layer.props) layer.props = {} as any;
    const props = layer.props as any;

    // Tells Text to align from the top-left, matching Yoga's coordinates.
    props._computedLayout = true;

    props.position = { ...props.position, x: layout.left, y: layout.top };

    if ("centring" in props) props.centring = "start-top";

    if ("size" in props) {
      props.size = { ...props.size, width: layout.width, height: layout.height };
    }

    const record: LayoutRecord = {
      layer,
      layout: copyValue(props.layout),
      position: props.position,
      x: props.position.x,
      y: props.position.y,
      size: props.size,
      width: props.size?.width,
      height: props.size?.height,
      centring: props.centring,
      children: [],
    };
    if (layer.type === LayerType.Text && ctx && canvas) {
      record.text = this.measureTextLayer(layer as Text, ctx, canvas);
    }

    this.layoutChildren(layer).forEach((child, index) => {
      const childNode = node.getChild(index);
      if (childNode) record.children.push(this.applyLayout(childNode, child, ctx, canvas));
    });
    return record;
  }

  private freeNode(node: YogaNode) {
    if (node.freeRecursive) node.freeRecursive();
    else node.free();
  }

  // Helpers for Yoga enums
  private getFlexDirection(dir: string) {
    switch (dir) {
      case "row":
        return this.yoga!.FLEX_DIRECTION_ROW;
      case "column":
        return this.yoga!.FLEX_DIRECTION_COLUMN;
      case "row-reverse":
        return this.yoga!.FLEX_DIRECTION_ROW_REVERSE;
      case "column-reverse":
        return this.yoga!.FLEX_DIRECTION_COLUMN_REVERSE;
      default:
        return this.yoga!.FLEX_DIRECTION_ROW;
    }
  }

  private getJustifyContent(justify: string) {
    switch (justify) {
      case "flex-start":
        return this.yoga!.JUSTIFY_FLEX_START;
      case "center":
        return this.yoga!.JUSTIFY_CENTER;
      case "flex-end":
        return this.yoga!.JUSTIFY_FLEX_END;
      case "space-between":
        return this.yoga!.JUSTIFY_SPACE_BETWEEN;
      case "space-around":
        return this.yoga!.JUSTIFY_SPACE_AROUND;
      case "space-evenly":
        return this.yoga!.JUSTIFY_SPACE_EVENLY;
      default:
        return this.yoga!.JUSTIFY_FLEX_START;
    }
  }

  private getAlignItems(align: string) {
    switch (align) {
      case "flex-start":
        return this.yoga!.ALIGN_FLEX_START;
      case "center":
        return this.yoga!.ALIGN_CENTER;
      case "flex-end":
        return this.yoga!.ALIGN_FLEX_END;
      case "stretch":
        return this.yoga!.ALIGN_STRETCH;
      case "baseline":
        return this.yoga!.ALIGN_BASELINE;
      default:
        return this.yoga!.ALIGN_STRETCH;
    }
  }

  private getPositionType(position: string) {
    if (position === "absolute") return this.yoga!.POSITION_TYPE_ABSOLUTE;
    return this.yoga!.POSITION_TYPE_RELATIVE;
  }

  private setDimension(node: YogaNode, prop: "width" | "height", value: any) {
    if (typeof value === "number") {
      if (prop === "width") node.setWidth(value);
      else node.setHeight(value);
    } else if (typeof value === "string") {
      if (value.endsWith("%")) {
        const val = Number.parseFloat(value);
        if (prop === "width") node.setWidthPercent(val);
        else node.setHeightPercent(val);
      } else if (value === "auto") {
        if (prop === "width") node.setWidthAuto();
        else node.setHeightAuto();
      }
    }
  }

  private setPadding(node: YogaNode, padding: number | number[]) {
    if (typeof padding === "number") {
      node.setPadding(this.yoga!.EDGE_ALL, padding);
    } else if (Array.isArray(padding)) {
      // CSS order: top, right, bottom, left
      if (padding.length === 1) node.setPadding(this.yoga!.EDGE_ALL, padding[0]);
      else if (padding.length === 2) {
        node.setPadding(this.yoga!.EDGE_VERTICAL, padding[0]);
        node.setPadding(this.yoga!.EDGE_HORIZONTAL, padding[1]);
      } else if (padding.length === 4) {
        node.setPadding(this.yoga!.EDGE_TOP, padding[0]);
        node.setPadding(this.yoga!.EDGE_RIGHT, padding[1]);
        node.setPadding(this.yoga!.EDGE_BOTTOM, padding[2]);
        node.setPadding(this.yoga!.EDGE_LEFT, padding[3]);
      }
    }
  }

  private setMargin(node: YogaNode, margin: number | number[]) {
    if (typeof margin === "number") {
      node.setMargin(this.yoga!.EDGE_ALL, margin);
    } else if (Array.isArray(margin)) {
      if (margin.length === 1) node.setMargin(this.yoga!.EDGE_ALL, margin[0]);
      else if (margin.length === 2) {
        node.setMargin(this.yoga!.EDGE_VERTICAL, margin[0]);
        node.setMargin(this.yoga!.EDGE_HORIZONTAL, margin[1]);
      } else if (margin.length === 4) {
        node.setMargin(this.yoga!.EDGE_TOP, margin[0]);
        node.setMargin(this.yoga!.EDGE_RIGHT, margin[1]);
        node.setMargin(this.yoga!.EDGE_BOTTOM, margin[2]);
        node.setMargin(this.yoga!.EDGE_LEFT, margin[3]);
      }
    }
  }
}

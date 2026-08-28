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
  restoreAuthoredProps,
  walkLayers,
} from "../../utils";
import { Div, type TextLayer } from "../components";

// Define minimal types for Yoga to avoid import issues
type YogaNode = any;
type Yoga = any;

export class LayoutManager {
  private yoga: Yoga | null = null;
  private debug: boolean;
  public ready: Promise<void>;

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
  private layoutChildren(layer: AnyLayer | Div): Array<AnyLayer | Div> {
    return getChildren(layer).filter((child) => {
      const isContainer = child instanceof Div || child.type === LayerType.Group;
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
   * @param {AnyLayer | Div} [root] - Root of the tree to lay out.
   * @param {number} [width] - Available width.
   * @param {number} [height] - Available height.
   * @param {ICanvasRenderingContext2D} [ctx] - Context used to measure text.
   * @param {ICanvas} [canvas] - Canvas used to measure text.
   */
  public calculateLayout(
    root: AnyLayer | Div,
    width: number,
    height: number,
    ctx?: ICanvasRenderingContext2D,
    canvas?: ICanvas,
  ) {
    if (!this.yoga) {
      if (this.debug) LazyLog.log("warn", "LayoutManager: Yoga not initialized yet");
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

    this.applyLayout(rootNode, root);

    this.freeNode(rootNode);
  }

  private createNode(
    layer: AnyLayer | Div,
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
      // For TextLayer, skip size.width to allow measureFunc to work
      this.setDimension(node, "width", size.width);
    } else if ((layer instanceof Div || layer.type === "group") && !layout.flexDirection) {
      // For Div without explicit width and not a flex container, stretch to parent
      // Flex containers should shrink-wrap their content by default
      node.setWidthPercent(100);
    }

    if (layout.height !== undefined) {
      this.setDimension(node, "height", layout.height);
    } else if (size.height !== undefined && layer.type !== LayerType.Text) {
      // For TextLayer, skip size.height to allow measureFunc to work
      this.setDimension(node, "height", size.height);
    } else if ((layer instanceof Div || layer.type === "group") && !layout.flexDirection) {
      // For Div without explicit height and not a flex container, stretch to parent
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

    // Handle TextLayer measurement
    if (layer.type === LayerType.Text && ctx && canvas) {
      node.setMeasureFunc((width: number, widthMode: any, height: number, heightMode: any) => {
        const textLayer = layer as TextLayer;

        // Save original align/baseline for accurate measurement
        const originalAlign = textLayer.props.align;
        const originalBaseline = textLayer.props.baseline;

        // Set to top-left for measurement (Yoga expects top-left coordinates)
        textLayer.props.align = "left";
        textLayer.props.baseline = "top";

        // Temporarily disable multiline and width to measure natural size
        const originalSize = textLayer.props.size ? { ...textLayer.props.size } : undefined;
        const originalMultiline = textLayer.props.multiline
          ? { ...textLayer.props.multiline }
          : undefined;

        // Disable multiline for measurement
        if (textLayer.props.multiline) {
          textLayer.props.multiline.enabled = false;
        }

        // Don't set width constraint for natural measurement
        if (textLayer.props.size) {
          (textLayer.props.size as any).width = undefined;
        }

        const size = textLayer.measureText(ctx, canvas);

        // Restore original props
        if (originalSize) textLayer.props.size = originalSize;
        if (originalMultiline) textLayer.props.multiline = originalMultiline;
        textLayer.props.align = originalAlign;
        textLayer.props.baseline = originalBaseline;

        return { width: Math.ceil(size.width), height: Math.ceil(size.height) };
      });
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
  private applyLayout(node: YogaNode, layer: AnyLayer | Div) {
    const layout = node.getComputedLayout();

    if (this.debug) {
      LazyLog.log(
        "info",
        `[Layout] ${layer.id}: left=${layout.left}, top=${layout.top}, width=${layout.width}, height=${layout.height}`,
      );
    }

    if (!layer.props) layer.props = {} as any;
    const props = layer.props as any;

    // Tells TextLayer to align from the top-left, matching Yoga's coordinates.
    props._computedLayout = true;

    props.position = { ...props.position, x: layout.left, y: layout.top };

    if ("centring" in props) props.centring = "start-top";

    if ("size" in props) {
      props.size = { ...props.size, width: layout.width, height: layout.height };
    }

    this.layoutChildren(layer).forEach((child, index) => {
      const childNode = node.getChild(index);
      if (childNode) this.applyLayout(childNode, child);
    });
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

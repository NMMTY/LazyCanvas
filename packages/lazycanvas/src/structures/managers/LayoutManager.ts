import { Div, TextLayer } from "../components";
import { AnyLayer, LayerType } from "../../types";
import { LazyLog } from "../../utils";
import { SKRSContext2D, Canvas, SvgCanvas } from "@napi-rs/canvas";

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
      this.yoga = await import("yoga-layout");
    } catch (e) {
      // Fallback
      try {
        const yoga = require("yoga-layout");
        this.yoga = yoga;
      } catch (e2) {
        console.error("Failed to initialize Yoga Layout", e, e2);
      }
    }
  }

  public calculateLayout(
    root: AnyLayer | Div,
    width: number,
    height: number,
    ctx?: SKRSContext2D,
    canvas?: Canvas | SvgCanvas,
  ) {
    if (!this.yoga) {
      if (this.debug) LazyLog.log("warn", "LayoutManager: Yoga not initialized yet");
      return;
    }

    const rootNode = this.createNode(root, ctx, canvas);
    if (!rootNode) return;

    rootNode.setWidth(width);
    rootNode.setHeight(height);

    rootNode.calculateLayout(width, height, this.yoga.DIRECTION_LTR);

    this.applyLayout(rootNode, root);

    // Clean up
    this.freeNode(rootNode);
  }

  private createNode(
    layer: AnyLayer | Div,
    ctx?: SKRSContext2D,
    canvas?: Canvas | SvgCanvas,
  ): YogaNode | null {
    if (!this.yoga) return null;

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

    // Handle children
    if (layer instanceof Div || (layer.type === "group" && "layers" in layer)) {
      const children = (layer as Div).layers;
      let childIndex = 0;
      children.forEach((child) => {
        const childLayout = (child.props as any)?.layout;
        const childPosition = (child.props as any)?.position;

        // IMPORTANT: Logic for deciding if child participates in Yoga layout:
        // 1. Div/containers always participate (they manage their own children)
        // 2. If layer has explicit position prop (x or y set), skip Yoga - use position-based positioning
        // 3. If layer has explicit layout prop, use Yoga layout
        // 4. Otherwise (no position, no layout), use Yoga layout by default for proper flow

        const isContainer = child instanceof Div || child.type === "group";
        const hasExplicitPosition =
          childPosition && (childPosition.x !== undefined || childPosition.y !== undefined);
        const hasExplicitLayout = childLayout !== undefined && Object.keys(childLayout).length > 0;

        // Skip Yoga layout if:
        // - Not a container AND has explicit position set (user wants manual positioning)
        if (!isContainer && hasExplicitPosition && !hasExplicitLayout) {
          return; // Skip this child - it will use position-based positioning
        }

        const childNode = this.createNode(child, ctx, canvas);
        if (childNode) {
          node.insertChild(childNode, childIndex++);
        }
      });
    } else if ("children" in layer && Array.isArray((layer as any).children)) {
      const children = (layer as any).children;
      let childIndex = 0;
      children.forEach((child: AnyLayer | Div) => {
        const childLayout = (child.props as any)?.layout;
        const childPosition = (child.props as any)?.position;

        const isContainer = child instanceof Div || child.type === "group";
        const hasExplicitPosition =
          childPosition && (childPosition.x !== undefined || childPosition.y !== undefined);
        const hasExplicitLayout = childLayout !== undefined && Object.keys(childLayout).length > 0;

        if (!isContainer && hasExplicitPosition && !hasExplicitLayout) {
          return; // Skip this child - it will use position-based positioning
        }

        const childNode = this.createNode(child, ctx, canvas);
        if (childNode) {
          node.insertChild(childNode, childIndex++);
        }
      });
    }

    return node;
  }

  private applyLayout(node: YogaNode, layer: AnyLayer | Div) {
    const layout = node.getComputedLayout();

    // Debug logging if enabled
    if (this.debug) {
      console.log(
        `[Layout] ${layer.id}: left=${layout.left}, top=${layout.top}, width=${layout.width}, height=${layout.height}`,
      );
    }

    // Apply computed layout to layer props
    // We need to be careful not to overwrite original props if we want to recalculate
    // But for rendering, we need the absolute positions.
    // Maybe we should store computed layout separately or update position?

    // For now, let's update position and size if they are not fixed?
    // Or better, update a specific 'computedLayout' property if we added one.
    // Since we didn't add 'computedLayout', let's update position.

    // Note: Yoga calculates relative positions. We might need to convert to absolute if the renderer expects absolute.
    // But if the renderer handles hierarchy (Div draws children), relative is fine.

    if (!layer.props) layer.props = {} as any;
    if (!(layer.props as any).position) (layer.props as any).position = { x: 0, y: 0 };

    // Mark that this layer has computed layout from Yoga
    // This will be used by TextLayer to know it should use top-left alignment
    (layer.props as any)._computedLayout = true;

    // Update position
    (layer.props as any).position.x = layout.left;
    (layer.props as any).position.y = layout.top;

    // If layout is applied, we should probably force centring to top-left (start-top)
    // to match Yoga's coordinate system
    if ("centring" in layer.props) {
      (layer.props as any).centring = "start-top"; // or "none" depending on implementation
    }

    // Update size if applicable (e.g. Div or layers that support size)
    if ("size" in (layer.props as any)) {
      // @ts-ignore
      const currentSize = (layer.props as any).size;
      // @ts-ignore
      (layer.props as any).size = { ...currentSize, width: layout.width, height: layout.height };
    } else if (layer instanceof Div) {
      // Div doesn't have size prop usually, but maybe it should?
    }

    // Recursively apply to children
    if (layer instanceof Div || (layer.type === "group" && "layers" in layer)) {
      const children = (layer as Div).layers;
      let yogaChildIndex = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // Check if this child was added to Yoga tree
        // Must match the logic in createNode
        const childLayout = (child.props as any)?.layout;
        const childPosition = (child.props as any)?.position;
        const isContainer = child instanceof Div || child.type === "group";
        const hasExplicitPosition =
          childPosition && (childPosition.x !== undefined || childPosition.y !== undefined);
        const hasExplicitLayout = childLayout !== undefined && Object.keys(childLayout).length > 0;

        // Skip if this child wasn't added to Yoga tree
        if (!isContainer && hasExplicitPosition && !hasExplicitLayout) {
          continue;
        }

        const childNode = node.getChild(yogaChildIndex++);
        if (childNode) {
          this.applyLayout(childNode, child);
        }
      }
    } else if ("children" in layer && Array.isArray((layer as any).children)) {
      const children = (layer as any).children;
      let yogaChildIndex = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        const childLayout = (child.props as any)?.layout;
        const childPosition = (child.props as any)?.position;
        const isContainer = child instanceof Div || child.type === "group";
        const hasExplicitPosition =
          childPosition && (childPosition.x !== undefined || childPosition.y !== undefined);
        const hasExplicitLayout = childLayout !== undefined && Object.keys(childLayout).length > 0;

        if (!isContainer && hasExplicitPosition && !hasExplicitLayout) {
          continue;
        }

        const childNode = node.getChild(yogaChildIndex++);
        if (childNode) {
          this.applyLayout(childNode, child);
        }
      }
    }
  }

  private freeNode(node: YogaNode) {
    // Recursively free nodes? Yoga might handle this if we free root?
    // Yoga JS usually requires manual freeing.
    // node.freeRecursive(); // if available
    if (node.freeRecursive) {
      node.freeRecursive();
    } else {
      node.free();
    }
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
        const val = parseFloat(value);
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

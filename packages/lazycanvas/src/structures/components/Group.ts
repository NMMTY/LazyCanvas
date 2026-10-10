import {
  type AnyGlobalCompositeOperation,
  type AnyLayer,
  type ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  LayerType,
} from "../../types";
import { LazyLog, authoredProps, generateID, getChildren, throwFirst } from "../../utils";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerProps } from "./BaseLayer";

/**
 * Interface representing a group of layer's.
 */
export interface IGroup extends IBaseLayer {
  /**
   * The unique identifier of the group.
   */
  id: string;

  /**
   * The type of the group, which is `Group`.
   */
  type: LayerType.Group;

  /**
   * The visibility of the group.
   */
  visible: boolean;

  /**
   * The z-index of the group, determining its stacking order.
   */
  zIndex: number;

  /**
   * The layer's contained within the group.
   */
  layers: Array<AnyLayer | Group>;

  /**
   * The properties specific to the Group group.
   */
  props: IGroupProps;
}

export interface IGroupProps extends IBaseLayerProps {
  /**
   * Don't use, this is just for compatibility.
   */
  globalComposite?: AnyGlobalCompositeOperation;

  children?: any;
}

/**
 * Class representing a group of layer's.
 */
export class Group extends BaseLayer<IGroupProps> implements IGroup {
  /**
   * The unique identifier of the group.
   */
  id: string;

  /**
   * The type of the group, which is `Group`.
   */
  type: LayerType.Group = LayerType.Group;

  /**
   * The visibility of the group.
   */
  visible: boolean;

  /**
   * The z-index of the group, determining its stacking order.
   */
  zIndex: number;

  props: IGroupProps;
  parent?: IBaseLayer | any | null;

  /**
   * The layers contained within the group.
   *
   * Alias of {@link BaseLayer.children}. A group used to keep its subtree in a
   * second array, so every traversal had to know about both containers; they
   * are now the same list.
   */
  get layers(): Array<AnyLayer | Group> {
    return this.children;
  }

  set layers(value: Array<AnyLayer | Group>) {
    this.children = value;
  }

  /**
   * Constructs a new Group instance.
   * @param {IGroupProps} [props] - The properties of the Group.
   * @param {string} [opts.id] - The unique identifier of the group.
   * @param {boolean} [opts.visible] - The visibility of the group.
   * @param {number} [opts.zIndex] - The z-index of the group.
   */
  constructor(props?: IGroupProps, opts?: { id?: string; visible?: boolean; zIndex?: number }) {
    super(LayerType.Group, props || ({} as IGroupProps), opts);

    // Extract id, visible, zIndex from props if provided (for JSX support)
    const propsId = props?.id;
    const propsVisible = props?.visible;
    const propsZIndex = props?.zIndex;

    this.id = opts?.id || propsId || generateID(LayerType.Group);
    this.visible = opts?.visible ?? propsVisible ?? true;
    this.zIndex = opts?.zIndex ?? propsZIndex ?? 1;
    this.props = props || ({} as IGroupProps);
    this.parent = null;
  }

  /**
   * Sets the ID of the group.
   * @param {string} [id] - The unique identifier of the group.
   * @returns {this} The current instance for chaining.
   */
  setID(id: string): this {
    this.id = id;
    return this;
  }

  /**
   * Sets the visibility of the group.
   * @param {boolean} [visible] - The visibility state of the group.
   * @returns {this} The current instance for chaining.
   */
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  /**
   * Sets the z-index of the group.
   * @param {number} [zIndex] - The z-index value of the group.
   * @returns {this} The current instance for chaining.
   */
  setZIndex(zIndex: number): this {
    this.zIndex = zIndex;
    return this;
  }

  /**
   * Clears all components from the group.
   * @returns {this} The current instance for chaining.
   */
  clear(): this {
    this.children = [];
    return this;
  }

  /**
   * Gets the number of components in the group.
   * @returns {number} The number of components in the group.
   */
  get length(): number {
    return this.layers.length;
  }

  /**
   * Renders a layer and, unless it manages its own children, its subtree.
   * @param {AnyLayer | Group} [layer] - The layer or group to render.
   * @param {ICanvasRenderingContext2D} [ctx] - The canvas rendering context.
   * @param {ICanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @param {ICanvasAdapter} [adapter] - The canvas adapter.
   * @returns {Promise<ICanvasRenderingContext2D>} The context after rendering.
   */
  private async renderLayer(
    layer: AnyLayer | Group,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ): Promise<ICanvasRenderingContext2D> {
    if (debug) LazyLog.log("info", `Rendering ${layer.id}...\nData:`, layer.toJSON());
    if (!layer.visible) return ctx;

    ctx.globalCompositeOperation = layer.props?.globalComposite || "source-over";

    await layer.draw(ctx, canvas, manager, debug, adapter);

    // A Group renders its own subtree inside `draw`, so descending into it here
    // would draw every descendant twice.
    const children = layer instanceof Group ? [] : getChildren(layer);
    if (children.length > 0) {
      const errors: unknown[] = [];

      ctx.save();
      try {
        // Layout positions are relative to the parent, so move into the parent's
        // coordinate space before drawing the children.
        const position = layer.props?.position;
        if (position) {
          const x = typeof position.x === "number" ? position.x : 0;
          const y = typeof position.y === "number" ? position.y : 0;
          ctx.translate(x, y);
        }

        for (const child of children) {
          try {
            await this.renderLayer(child, ctx, canvas, manager, debug, adapter);
          } catch (error) {
            errors.push(error);
          }
        }
      } finally {
        ctx.restore();
      }

      throwFirst(errors);
    }

    ctx.shadowColor = "transparent";
    return ctx;
  }

  public async draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ) {
    const errors: unknown[] = [];

    ctx.save();
    try {
      // Apply position translation if available (from layout)
      if (this.props.position) {
        const x = typeof this.props.position.x === "number" ? this.props.position.x : 0;
        const y = typeof this.props.position.y === "number" ? this.props.position.y : 0;
        ctx.translate(x, y);
      }

      // One layer failing must not take its siblings down with it, nor leave the
      // context translated for whatever is drawn next: draw everything, put the
      // state back, and only then report.
      for (const subLayer of this.layers) {
        if (debug) LazyLog.log("info", `Rendering ${subLayer.id}...\nData:`, subLayer.toJSON());
        if (subLayer.visible) {
          try {
            await this.renderLayer(subLayer, ctx, canvas, manager, debug, adapter);
          } catch (error) {
            errors.push(error);
          }
        }
      }
    } finally {
      ctx.restore();
    }

    throwFirst(errors);
  }

  /**
   * Converts the group to a JSON representation.
   * @returns {IGroup} The JSON representation of the group.
   */
  toJSON(): IGroup {
    return {
      id: this.id,
      type: this.type,
      visible: this.visible,
      zIndex: this.zIndex,
      props: authoredProps(this),
      // @ts-ignore
      layers: this.layers.map((c) => c.toJSON()),
    };
  }
}

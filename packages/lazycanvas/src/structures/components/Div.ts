import {
  type AnyGlobalCompositeOperation,
  type AnyLayer,
  type ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  LayerType,
} from "../../types";
import { LazyLog, generateID, getChildren } from "../../utils";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerProps } from "./BaseLayer";

/**
 * Interface representing a group of layer's.
 */
export interface IDiv extends IBaseLayer {
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
  layers: Array<AnyLayer | Div>;

  /**
   * The properties specific to the Div group.
   */
  props: IDivProps;
}

export interface IDivProps extends IBaseLayerProps {
  /**
   * Don't use, this is just for compatibility.
   */
  globalComposite?: AnyGlobalCompositeOperation;

  children?: any;
}

/**
 * Class representing a group of layer's.
 */
export class Div extends BaseLayer<IDivProps> implements IDiv {
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

  /**
   * The layer's contained within the group.
   */
  layers: Array<AnyLayer | Div>;

  props: IDivProps;
  parent?: IBaseLayer | any | null;

  /**
   * Constructs a new Group instance.
   * @param {IDivProps} [props] - The properties of the Div.
   * @param {string} [opts.id] - The unique identifier of the group.
   * @param {boolean} [opts.visible] - The visibility of the group.
   * @param {number} [opts.zIndex] - The z-index of the group.
   */
  constructor(props?: IDivProps, opts?: { id?: string; visible?: boolean; zIndex?: number }) {
    super(LayerType.Group, props || ({} as IDivProps), opts);

    // Extract id, visible, zIndex from props if provided (for JSX support)
    const propsId = props?.id;
    const propsVisible = props?.visible;
    const propsZIndex = props?.zIndex;

    this.id = opts?.id || propsId || generateID(LayerType.Group);
    this.visible = opts?.visible ?? propsVisible ?? true;
    this.zIndex = opts?.zIndex ?? propsZIndex ?? 1;
    this.layers = [];
    this.props = props || ({} as IDivProps);
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
   * Adds components to the group.
   * @param {AnyLayer[] | Div[]} [components] - The components to add to the group.
   * @returns {this} The current instance for chaining.
   */
  add(...components: Array<AnyLayer | Div>): this {
    let layersArray = components.filter((l) => l !== undefined);
    layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of layersArray) {
      layer.parent = this;
    }
    this.layers.push(...layersArray);
    return this;
  }

  /**
   * Removes a component from the group by its ID.
   * @param {string} [id] - The unique identifier of the component to remove.
   * @returns {this} The current instance for chaining.
   */
  remove(id: string): this {
    this.layers = this.layers.filter((c) => c.id !== id);
    return this;
  }

  /**
   * Clears all components from the group.
   * @returns {this} The current instance for chaining.
   */
  clear(): this {
    this.layers = [];
    return this;
  }

  /**
   * Retrieves a component from the group by its ID.
   * @param {string} [id] - The unique identifier of the component to retrieve.
   * @returns {AnyLayer | Div | undefined} The component with the specified ID, or undefined if not found.
   */
  get(id: string): AnyLayer | Div | undefined {
    return this.layers.find((c) => c.id === id);
  }

  /**
   * Retrieves all components from the group.
   * @returns {AnyLayer[] | Div[]} An array of all components in the group.
   */
  getAll(): Array<AnyLayer | Div> {
    return this.layers;
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
   * @param {AnyLayer | Div} [layer] - The layer or group to render.
   * @param {ICanvasRenderingContext2D} [ctx] - The canvas rendering context.
   * @param {ICanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @param {ICanvasAdapter} [adapter] - The canvas adapter.
   * @returns {Promise<ICanvasRenderingContext2D>} The context after rendering.
   */
  private async renderLayer(
    layer: AnyLayer | Div,
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

    // A Div renders its own subtree inside `draw`, so descending into it here
    // would draw every descendant twice.
    const children = layer instanceof Div ? [] : getChildren(layer);
    if (children.length > 0) {
      ctx.save();

      // Layout positions are relative to the parent, so move into the parent's
      // coordinate space before drawing the children.
      const position = layer.props?.position;
      if (position) {
        const x = typeof position.x === "number" ? position.x : 0;
        const y = typeof position.y === "number" ? position.y : 0;
        ctx.translate(x, y);
      }

      for (const child of children) {
        await this.renderLayer(child, ctx, canvas, manager, debug, adapter);
      }

      ctx.restore();
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
    ctx.save();

    // Apply position translation if available (from layout)
    if (this.props.position) {
      const x = typeof this.props.position.x === "number" ? this.props.position.x : 0;
      const y = typeof this.props.position.y === "number" ? this.props.position.y : 0;
      ctx.translate(x, y);
    }

    for (const subLayer of this.layers) {
      if (debug) LazyLog.log("info", `Rendering ${subLayer.id}...\nData:`, subLayer.toJSON());
      if (subLayer.visible) {
        await this.renderLayer(subLayer, ctx, canvas, manager, debug, adapter);
      }
    }
    ctx.restore();
  }

  /**
   * Converts the group to a JSON representation.
   * @returns {IDiv} The JSON representation of the group.
   */
  toJSON(): IDiv {
    return {
      id: this.id,
      type: this.type,
      visible: this.visible,
      zIndex: this.zIndex,
      props: this.props,
      // @ts-ignore
      layers: this.layers.map((c) => c.toJSON()),
    };
  }
}

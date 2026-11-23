import {
  type AnyGlobalCompositeOperation,
  type AnyLayer,
  type ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  LayerType,
} from "../../types";
import {
  type Later,
  LazyLog,
  authoredProps,
  bumpTreeVersion,
  eachInOrder,
  generateID,
  getChildren,
  isLater,
  throwFirst,
} from "../../utils";
import type { BakedRun, LayersManager } from "../managers";
import { drawLayerCached } from "../managers/LayerCache";
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
    bumpTreeVersion();
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
    bumpTreeVersion();
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
   *
   * Nothing here is `async`: when every layer can be drawn at once (a plain colour is) the whole tree is drawn
   * without a single promise, and only a layer that has to wait (an image) makes the rest continue after it.
   *
   * @param {AnyLayer | Group} [layer] - The layer or group to render.
   * @param {ICanvasRenderingContext2D} [ctx] - The canvas rendering context.
   * @param {ICanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @param {ICanvasAdapter} [adapter] - The canvas adapter.
   */
  private renderLayer(
    layer: AnyLayer | Group,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter: ICanvasAdapter | undefined,
    scope: { composite?: string },
  ): Later {
    if (debug) LazyLog.log("info", `Rendering ${layer.id}...\nData:`, layer.toJSON());
    if (!layer.visible) return;

    // Each assignment is a call into the native canvas, and nearly every layer is drawn in the mode the one
    // before it was. `scope` remembers the mode of the layers drawn at this level (what is changed deeper is
    // undone by `restore`), so it is only set when it changes.
    const composite = layer.props?.globalComposite || "source-over";
    if (scope.composite !== composite) {
      ctx.globalCompositeOperation = composite;
      scope.composite = composite;
    }

    const drawn = drawLayerCached(layer, ctx, canvas, manager, debug, adapter);
    if (isLater(drawn)) {
      return drawn.then(() =>
        this.renderChildren(layer, ctx, canvas, manager, debug, adapter, scope),
      );
    }
    return this.renderChildren(layer, ctx, canvas, manager, debug, adapter, scope);
  }

  /** What follows drawing a layer: the layers inside it, when it has some that it does not draw itself. */
  private renderChildren(
    layer: AnyLayer | Group,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter: ICanvasAdapter | undefined,
    scope: { composite?: string },
  ): Later {
    // A Group renders its own subtree inside `draw`, so descending into it here
    // would draw every descendant twice.
    const children = layer instanceof Group ? [] : getChildren(layer);
    if (children.length === 0) {
      this.leave(layer, ctx);
      return;
    }

    const errors: unknown[] = [];
    ctx.save();
    let pending: Later;
    try {
      // Layout positions are relative to the parent, so move into the parent's
      // coordinate space before drawing the children.
      const position = layer.props?.position;
      if (position) {
        const x = typeof position.x === "number" ? position.x : 0;
        const y = typeof position.y === "number" ? position.y : 0;
        ctx.translate(x, y);
      }
      (layer as { recordChildSpace?: (c: ICanvasRenderingContext2D) => void }).recordChildSpace?.(
        ctx,
      );

      const childScope = { composite: scope.composite };
      pending = this.drawList(
        children,
        ctx,
        canvas,
        manager,
        debug,
        adapter,
        childScope,
        errors,
        (child, c, cv, sc) => this.renderLayer(child, c, cv, manager, debug, adapter, sc),
      );
    } catch (error) {
      ctx.restore();
      throw error;
    }

    if (isLater(pending)) {
      return pending.then(() => {
        ctx.restore();
        throwFirst(errors);
        this.leave(layer, ctx);
      });
    }
    ctx.restore();
    throwFirst(errors);
    this.leave(layer, ctx);
  }

  /**
   * Draws a list of neighbours in order. When the scene bakes, the ones that stay the same from frame to frame
   * are drawn together, as one picture.
   */
  private drawList(
    list: readonly (AnyLayer | Group)[],
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter: ICanvasAdapter | undefined,
    scope: { composite?: string },
    errors: unknown[],
    step: (
      layer: AnyLayer | Group,
      ctx: ICanvasRenderingContext2D,
      canvas: ICanvas,
      scope: { composite?: string },
    ) => Later,
  ): Later {
    const baker = manager.baker;
    // Logging a layer is a reason to draw it, not to draw a picture of it.
    const units = baker && !debug ? baker.units(list, ctx, canvas) : null;
    if (!units || !baker) {
      return eachInOrder(list, (layer) => step(layer, ctx, canvas, scope), errors);
    }

    return eachInOrder(
      units,
      (unit) => {
        if (!("layers" in unit && "h1" in unit)) return step(unit, ctx, canvas, scope);
        const run = unit as BakedRun;
        return baker.draw(run, ctx, canvas, (c, cv, baking) => {
          // On a picture of its own nothing is known about the context: the first layer sets what it needs.
          const runScope = baking ? {} : scope;
          const failures: unknown[] = [];
          const done = eachInOrder(run.layers, (layer) => step(layer, c, cv, runScope), failures);
          if (isLater(done)) return done.then(() => throwFirst(failures));
          throwFirst(failures);
        });
      },
      errors,
    );
  }

  /**
   * A layer sets its shadow inside its own `save` and `restore`, so there is nothing to undo unless it has one
   * (or is a layer of someone else's that does not keep to that).
   */
  private leave(layer: AnyLayer | Group, ctx: ICanvasRenderingContext2D): void {
    if (layer.props?.shadow) ctx.shadowColor = "transparent";
  }

  public draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ): Later {
    const errors: unknown[] = [];

    ctx.save();
    let pending: Later;
    try {
      // Apply position translation if available (from layout)
      if (this.props.position) {
        const x = typeof this.props.position.x === "number" ? this.props.position.x : 0;
        const y = typeof this.props.position.y === "number" ? this.props.position.y : 0;
        ctx.translate(x, y);
      }

      // The transform of a group moves everything in it. Its box is its size, when it has one.
      const size = (this.props as { size?: { width?: unknown; height?: unknown } }).size;
      this.applyTransform(ctx, {
        x: 0,
        y: 0,
        width: typeof size?.width === "number" ? size.width : 0,
        height: typeof size?.height === "number" ? size.height : 0,
      });
      this.recordChildSpace(ctx);

      // One layer failing must not take its siblings down with it, nor leave the
      // context translated for whatever is drawn next: draw everything, put the
      // state back, and only then report.
      // What the context is set to is not known on entry, so the first layer sets it.
      const scope: { composite?: string } = {};
      pending = this.drawList(
        this.layers,
        ctx,
        canvas,
        manager,
        debug,
        adapter,
        scope,
        errors,
        (subLayer, c, cv, sc) => {
          if (debug) LazyLog.log("info", `Rendering ${subLayer.id}...\nData:`, subLayer.toJSON());
          if (subLayer.visible) {
            return this.renderLayer(subLayer, c, cv, manager, debug, adapter, sc);
          }
        },
      );
    } catch (error) {
      ctx.restore();
      throw error;
    }

    const finish = () => {
      ctx.restore();
      throwFirst(errors);
    };
    if (isLater(pending)) return pending.then(finish);
    finish();
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

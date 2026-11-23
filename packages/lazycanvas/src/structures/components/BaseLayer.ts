import { Matrix } from "../../core/Matrix";
import { Signal } from "../../core/Signal";
import type { Vector2 } from "../../core/Vector2";
import {
  type AnyCentring,
  type AnyFilter,
  type AnyGlobalCompositeOperation,
  type AnyLayer,
  Centring,
  type ICanvasRenderingContext2D,
  type ILayoutProps,
  LayerType,
  type ScaleType,
} from "../../types";
import {
  LazyError,
  authoredProps,
  bumpTreeVersion,
  generateID,
  isColor,
  transform,
} from "../../utils";
import {
  Gradient,
  Link,
  Pattern,
  Transform,
  type TransformBox,
  type TransformOrigin,
  type TransformProps,
} from "../helpers";
import type { Group } from "./Group";

/**
 * Interface representing the base structure of a layer.
 */
export interface IBaseLayer {
  /**
   * The unique identifier of the layer.
   */
  id: string;

  /**
   * The parent of the layer.
   */
  parent?: IBaseLayer | any | null;

  /**
   * The children of the layer.
   */
  children?: Array<AnyLayer | Group>;

  /**
   * The type of the layer.
   */
  type: LayerType;

  /**
   * The z-index of the layer, determining its stacking order.
   */
  zIndex: number;

  /**
   * Whether the layer is visible.
   */
  visible: boolean;

  /**
   * The properties of the layer.
   */
  props: IBaseLayerProps;
}

/**
 * Interface representing the properties of a base layer.
 */
export interface IBaseLayerProps {
  /**
   * The unique identifier of the layer (optional, for JSX support).
   */
  id?: string;

  /**
   * Whether the layer is visible (optional, for JSX support).
   */
  visible?: boolean;

  /**
   * The z-index of the layer (optional, for JSX support).
   */
  zIndex?: number;

  position?: {
    /**
     * The x-coordinate of the layer.
     */
    x: ScaleType;

    /**
     * The y-coordinate of the layer.
     */
    y: ScaleType;
  };

  /**
   * The layout properties of the layer.
   */
  layout?: ILayoutProps;

  /**
   * Whether the scene may keep the picture of this layer and reuse it in the next frame (see
   * `LayerCache`). Only takes effect on a scene created with `cache`. `true` stores the layer,
   * `false` never does; left out, layers with a `filter` are stored and the rest are drawn as usual.
   */
  cache?: boolean;

  /**
   * The centring type of the layer.
   */
  centring?: AnyCentring;

  /**
   * The filter effects applied to the layer.
   */
  filter?: string;

  /**
   * The opacity of the layer, ranging from 0 to 1.
   */
  opacity?: number | Signal<number>;

  /**
   * The shadow properties of the layer.
   */
  shadow?: {
    /**
     * The color of the shadow.
     */
    color: string;

    /**
     * The blur radius of the shadow.
     */
    blur: number;

    /**
     * The horizontal offset of the shadow.
     */
    offsetX?: number;

    /**
     * The vertical offset of the shadow.
     */
    offsetY?: number;
  };

  /**
   * The transformation properties of the layer.
   */
  transform?: Transform | TransformProps | Signal<Transform>;

  /**
   * The global composite operation applied to the layer.
   */
  globalComposite?: AnyGlobalCompositeOperation;
}

/**
 * Interface representing miscellaneous options for a base layer.
 */
export interface IBaseLayerMisc {
  /**
   * The unique identifier of the layer (optional).
   */
  id?: string;

  /**
   * The z-index of the layer (optional).
   */
  zIndex?: number;

  /**
   * Whether the layer is visible (optional).
   */
  visible?: boolean;
}

/**
 * Represents a base layer with generic properties and methods for managing
 * its position, visibility, transformations, and other attributes.
 *
 * @template T - A type extending `IBaseLayerProps` that defines the properties of the layer.
 */
export class BaseLayer<T extends IBaseLayerProps> implements IBaseLayer {
  id: string;
  type: LayerType;
  zIndex: number;
  visible: boolean;
  props: T;
  parent?: IBaseLayer | any | null;
  children: Array<AnyLayer | Group> = [];
  private _signals: Map<string, Signal<any>> = new Map();

  constructor(type: LayerType, props: T, misc?: IBaseLayerMisc) {
    // Extract id, visible, zIndex from props if provided (for JSX support)
    const propsId = (props as any).id;
    const propsVisible = (props as any).visible;
    const propsZIndex = (props as any).zIndex;

    this.id = misc?.id || propsId || generateID(type);
    this.type = type;
    this.zIndex = misc?.zIndex ?? propsZIndex ?? 1;
    this.visible = misc?.visible ?? propsVisible ?? true;
    this.props = props;
    this.parent = null;
    this.children = [];
    // Signals are taken out of the props below, which edits the object in place. A transform that
    // other layers share must keep its signals for them.
    if (props.transform instanceof Transform) props.transform = props.transform.clone();
    this.extractSignals(this.props, "");
  }

  /**
   * Adds components to the layer.
   * @param {AnyLayer[] | Group[]} [components] - The components to add to the layer.
   * @returns {this} The current instance for chaining.
   */
  add(...components: Array<AnyLayer | Group>): this {
    let layersArray = components.filter((l) => l !== undefined);
    layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of layersArray) {
      layer.parent = this;
    }
    this.children.push(...layersArray);
    bumpTreeVersion();
    return this;
  }

  /**
   * Removes a component from the layer by its ID.
   * @param {string} [id] - The unique identifier of the component to remove.
   * @returns {this} The current instance for chaining.
   */
  remove(id: string): this {
    this.children = this.children.filter((c) => c.id !== id);
    bumpTreeVersion();
    return this;
  }

  /**
   * Retrieves a component from the layer by its ID.
   * @param {string} [id] - The unique identifier of the component to retrieve.
   * @returns {AnyLayer | Group | undefined} The component with the specified ID, or undefined if not found.
   */
  get(id: string): AnyLayer | Group | undefined {
    return this.children.find((c) => c.id === id);
  }

  /**
   * Retrieves all components from the layer.
   * @returns {AnyLayer[] | Group[]} An array of all components in the layer.
   */
  getAll(): Array<AnyLayer | Group> {
    return this.children;
  }

  /**
   * Recursively extract signals from props and nested objects
   * @param obj - Object to extract signals from
   * @param path - Current property path (e.g., "size.width")
   */
  private extractSignals(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (value instanceof Signal) {
        // Store signal with its path
        this._signals.set(currentPath, value);
        // Replace signal with its initial value (at time 0)
        obj[key] = value.get(0);
      } else if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Gradient) &&
        !(value instanceof Pattern) &&
        !(value instanceof Link)
      ) {
        // Recursively process nested objects (but not arrays or special types)
        this.extractSignals(value, currentPath);
      }
    }
  }

  /**
   * The signals that drive this layer's props.
   * @returns {Signal<any>[]} The signals found in the props, in the order they were declared.
   */
  public listSignals(): Signal<any>[] {
    return [...this._signals.values()];
  }

  /**
   * Update layer properties from signals at given time
   * @param time - Current time in seconds
   */
  public updateState(time: number): void {
    this._signals.forEach((signal, path) => {
      // Just read the current value - signals are updated by the scheduler
      const value = signal.value ? signal.value() : signal.get(time);
      this.setNestedProperty(this.props, path, value);
    });
  }

  /**
   * Set a nested property value using dot notation path
   * @param obj - Object to set property on
   * @param path - Property path (e.g., "size.width")
   * @param value - Value to set
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Sets the position of the layer in the 2D plane.
   * @param {ScaleType} [x] - The x-coordinate of the layer.
   * @param {ScaleType} [y] - The y-coordinate of the layer.
   * @returns {this} The current instance for chaining.
   */
  setPosition(x: ScaleType, y: ScaleType): this {
    this.props.position = { x, y };
    return this;
  }

  /**
   * Sets the opacity of the layer.
   * @param {number} [opacity] - The opacity value, between 0 and 1.
   * @returns {this} The current instance for chaining.
   */
  setOpacity(opacity: number): this {
    this.props.opacity = opacity;
    return this;
  }

  /**
   * Sets the unique identifier of the layer.
   *
   * @param {string} [id] - The unique identifier.
   * @returns {this} The current instance for chaining.
   */
  setID(id: string): this {
    this.id = id;
    return this;
  }

  /**
   * Sets the shadow properties of the layer.
   * @param {string} [color] - The color of the shadow.
   * @param {number} [blur] - The blur radius of the shadow.
   * @param {number} [offsetX] - The horizontal offset of the shadow.
   * @param {number} [offsetY] - The vertical offset of the shadow.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the color is invalid or not provided.
   */
  setShadow(color: string, blur?: number, offsetX?: number, offsetY?: number): this {
    if (!color) throw new LazyError("The color of the shadow must be provided");
    if (!isColor(color)) throw new LazyError("The color of the shadow must be a valid color");
    this.props.shadow = {
      color: color,
      blur: blur || 0,
      offsetX: offsetX || 0,
      offsetY: offsetY || 0,
    };
    return this;
  }

  /**
   * Sets the transformation matrix of the layer.
   * @param {DOMMatrix2DInit} [matrix] - The transformation matrix.
   * @returns {this} The current instance for chaining.
   */
  setMatrix(matrix: DOMMatrix2DInit): this {
    this.props.transform = this.transformObject().with({ matrix });
    return this;
  }

  /**
   * Sets the scale of the layer in the x and y directions.
   * @param {number} [x] - The scale factor in the x direction.
   * @param {number} [y] - The scale factor in the y direction.
   * @returns {this} The current instance for chaining.
   */
  setScale(x: number, y: number): this {
    this.props.transform = this.transformObject().with({ scale: { x, y } });
    return this;
  }

  /**
   * Sets the rotation of the layer.
   * @param {number} [rotate] - The rotation angle in degrees.
   * @returns {this} The current instance for chaining.
   */
  setRotate(rotate: number): this {
    this.props.transform = this.transformObject().with({ rotate });
    return this;
  }

  /**
   * Sets the translation of the layer in the x and y directions.
   * @param {number} [x] - The translation in the x direction.
   * @param {number} [y] - The translation in the y direction.
   * @returns {this} The current instance for chaining.
   */
  setTranslate(x: number, y: number): this {
    this.props.transform = this.transformObject().with({ translate: { x, y } });
    return this;
  }

  /**
   * Sets the skew of the layer: a shear along each axis.
   * @param {number} [x] - The shear along x in degrees.
   * @param {number} [y] - The shear along y in degrees.
   * @returns {this} The current instance for chaining.
   */
  setSkew(x: number, y = 0): this {
    this.props.transform = this.transformObject().with({ skew: { x, y } });
    return this;
  }

  /**
   * Sets the point the layer rotates, scales and skews around.
   * @param {TransformOrigin} [origin] - A keyword such as `"center"`, or `{ x, y }` in pixels or percent.
   * @returns {this} The current instance for chaining.
   */
  setOrigin(origin: TransformOrigin): this {
    this.props.transform = this.transformObject().with({ origin });
    return this;
  }

  /**
   * Replaces the whole transform of the layer.
   * @param {Transform | TransformProps} [value] - The new transform.
   * @returns {this} The current instance for chaining.
   */
  setTransform(value: Transform | TransformProps): this {
    this.props.transform = value;
    return this;
  }

  private transformObject(): Transform {
    return Transform.from(this.props.transform as Transform | TransformProps | undefined);
  }

  /**
   * Applies the layer's transform to `ctx` and remembers where the layer is, so that
   * {@link BaseLayer.worldMatrix} and the other position methods can answer later.
   *
   * Every layer calls this from `draw`, after `ctx.save()` and before drawing anything.
   *
   * @param {ICanvasRenderingContext2D} [ctx] - The context being drawn to.
   * @param {TransformBox} [box] - The box the layer is drawn in, in its own coordinates.
   * @param {object} [extra] - Text details used by the rotation of a text layer that has no `origin`.
   * @param {TransformBox} [legacyBox] - The box the pre-`origin` rotation rules use, when it is not `box`.
   */
  protected applyTransform(
    ctx: ICanvasRenderingContext2D,
    box: TransformBox,
    extra?: { text: string; textAlign: any; fontSize: number; multiline: boolean },
    legacyBox: TransformBox = box,
  ): void {
    let own: Matrix | undefined;
    if (this.props.transform) {
      own = transform(
        ctx,
        this.props.transform as Transform | TransformProps,
        { ...legacyBox, type: this.type },
        extra,
        box,
      );
    }
    // Only numbers are kept: asking the canvas where it is would be a call into the native
    // library for every layer of every frame. The matrix is put together when it is asked for.
    this.renderState = { box, own, childSpace: undefined };
  }

  /**
   * Remembers where the context is, for the layers inside this one. A layer that draws its own
   * children (a group) calls this once its translation and transform are in place.
   *
   * @internal
   */
  public recordChildSpace(ctx: ICanvasRenderingContext2D): void {
    const raw = ctx.getTransform?.();
    const state = this.renderState;
    if (state) state.childSpace = raw ? Matrix.from(raw) : Matrix.identity();
  }

  /** Where the layer was drawn last. Set by {@link BaseLayer.applyTransform}. */
  private renderState:
    | { box: TransformBox; own: Matrix | undefined; childSpace: Matrix | undefined }
    | undefined;

  /**
   * Whether the layer has been drawn, so that its position is known.
   *
   * With a layer cache, a layer that comes out of the cache is not drawn again and keeps what it
   * had from the last time it was.
   */
  public isDrawn(): boolean {
    return this.renderState !== undefined;
  }

  private drawn(): { box: TransformBox; own: Matrix | undefined; childSpace: Matrix | undefined } {
    if (!this.renderState) {
      throw new LazyError(
        `Layer "${this.id}" has not been drawn yet, so its position is not known. Render a frame first.`,
      );
    }
    return this.renderState;
  }

  /**
   * The matrix from the layer's own coordinates to the canvas, as it was when the layer was
   * last drawn: the position of every parent, the layer's own transform, everything.
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public worldMatrix(): Matrix {
    const state = this.drawn();
    // A group's own space is the space of its children: its position and transform are in it.
    if (state.childSpace && this.isGroup()) return state.childSpace;

    const parent = this.parent as BaseLayer<any> | null | undefined;
    const space = parent?.renderState?.childSpace;
    return space
      ? space.multiply(state.own ?? Matrix.identity())
      : (state.own ?? Matrix.identity());
  }

  private isGroup(): boolean {
    return this.type === LayerType.Group;
  }

  /**
   * The box the layer was drawn in, in its own coordinates (before its transform).
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public bounds(): TransformBox {
    return { ...this.drawn().box };
  }

  /**
   * The four corners of the layer on the canvas, clockwise from the top-left, after every
   * transform.
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public worldCorners(): [Vector2, Vector2, Vector2, Vector2] {
    const { box } = this.drawn();
    const matrix = this.worldMatrix();
    return [
      matrix.apply({ x: box.x, y: box.y }),
      matrix.apply({ x: box.x + box.width, y: box.y }),
      matrix.apply({ x: box.x + box.width, y: box.y + box.height }),
      matrix.apply({ x: box.x, y: box.y + box.height }),
    ];
  }

  /**
   * The smallest upright rectangle on the canvas that holds the layer.
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public worldBounds(): TransformBox {
    const corners = this.worldCorners();
    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  /**
   * Where a point of the layer is on the canvas. `{ x: 0, y: 0 }` is the origin of the layer's
   * own coordinates, not its top-left corner: use `bounds()` for that.
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public localToWorld(point: { x: number; y: number }): Vector2 {
    return this.worldMatrix().apply(point);
  }

  /**
   * Which point of the layer is at a point of the canvas.
   * @throws {LazyError} If the layer has not been drawn yet, or its scale is `0`.
   */
  public worldToLocal(point: { x: number; y: number }): Vector2 {
    return this.worldMatrix().inverse().apply(point);
  }

  /**
   * Whether a point of the canvas is on the layer: inside its box after every transform
   * (so a rotated layer is hit where it is, not where its unrotated box was).
   * @throws {LazyError} If the layer has not been drawn yet.
   */
  public contains(point: { x: number; y: number }): boolean {
    const { box } = this.drawn();
    const matrix = this.worldMatrix();
    if (!matrix.invertible) return false;
    const local = matrix.inverse().apply(point);
    return (
      local.x >= box.x &&
      local.x <= box.x + box.width &&
      local.y >= box.y &&
      local.y <= box.y + box.height
    );
  }

  /**
   * Sets the filter effects for the layer.
   * @param {...AnyFilter} [filter] - The filter effects to apply.
   * @returns {this} The current instance for chaining.
   */
  setFilters(...filter: AnyFilter[]): this {
    this.props.filter = filter.join(" ");
    return this;
  }

  /**
   * Sets the centring type of the layer. **Don't affect on Bezier, Line, Quadratic and Text layers**.
   * @param {AnyCentring} [centring] - The centring type.
   * @returns {this} The current instance for chaining.
   */
  setCentring(centring: AnyCentring): this {
    this.props.centring = centring;
    return this;
  }

  /**
   * Sets the visibility of the layer.
   * @param {boolean} [visible] - The visibility state.
   * @returns {this} The current instance for chaining.
   */
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  /**
   * Sets the z-index of the layer.
   * @param {number} [zIndex] - The z-index value.
   * @returns {this} The current instance for chaining.
   */
  setZIndex(zIndex: number): this {
    this.zIndex = zIndex;
    return this;
  }

  /**
   * Sets the global composite operation for the layer.
   * @param {AnyGlobalCompositeOperation} [operation] - The composite operation.
   * @returns {this} The current instance for chaining.
   */
  setGlobalCompositeOperation(operation: AnyGlobalCompositeOperation): this {
    this.props.globalComposite = operation;
    return this;
  }

  /**
   * Converts the layer to a JSON representation.
   * @returns {IBaseLayer} The JSON representation of the layer.
   */
  toJSON(): IBaseLayer {
    return {
      id: this.id,
      type: this.type,
      zIndex: this.zIndex,
      visible: this.visible,
      props: authoredProps(this),
    };
  }

  protected validateProps(data: T): T {
    return {
      ...data,
      centring: data.centring || Centring.Center,
      filter: data.filter || "",
      opacity: data.opacity || 1,
      transform: data.transform || {},
      globalComposite: data.globalComposite || "source-over",
    };
  }
}

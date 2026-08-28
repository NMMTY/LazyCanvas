import { Signal } from "../../core/Signal";
import {
  type AnyCentring,
  type AnyFilter,
  type AnyGlobalCompositeOperation,
  type AnyLayer,
  Centring,
  type ILayoutProps,
  type LayerType,
  type ScaleType,
  type Transform,
} from "../../types";
import { LazyError, generateID, isColor } from "../../utils";
import { Gradient, Link, Pattern } from "../helpers";
import type { Div } from "./Div";

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
  children?: Array<AnyLayer | Div>;

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
  transform?: Transform;

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
  children: Array<AnyLayer | Div> = [];
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
    this.extractSignals(this.props, "");
  }

  /**
   * Adds components to the layer.
   * @param {AnyLayer[] | Div[]} [components] - The components to add to the layer.
   * @returns {this} The current instance for chaining.
   */
  add(...components: Array<AnyLayer | Div>): this {
    let layersArray = components.filter((l) => l !== undefined);
    layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of layersArray) {
      layer.parent = this;
    }
    this.children.push(...layersArray);
    return this;
  }

  /**
   * Removes a component from the layer by its ID.
   * @param {string} [id] - The unique identifier of the component to remove.
   * @returns {this} The current instance for chaining.
   */
  remove(id: string): this {
    this.children = this.children.filter((c) => c.id !== id);
    return this;
  }

  /**
   * Retrieves a component from the layer by its ID.
   * @param {string} [id] - The unique identifier of the component to retrieve.
   * @returns {AnyLayer | Div | undefined} The component with the specified ID, or undefined if not found.
   */
  get(id: string): AnyLayer | Div | undefined {
    return this.children.find((c) => c.id === id);
  }

  /**
   * Retrieves all components from the layer.
   * @returns {AnyLayer[] | Div[]} An array of all components in the layer.
   */
  getAll(): Array<AnyLayer | Div> {
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
    this.props.transform = { ...this.props.transform, matrix };
    return this;
  }

  /**
   * Sets the scale of the layer in the x and y directions.
   * @param {number} [x] - The scale factor in the x direction.
   * @param {number} [y] - The scale factor in the y direction.
   * @returns {this} The current instance for chaining.
   */
  setScale(x: number, y: number): this {
    this.props.transform = { ...this.props.transform, scale: { x, y } };
    return this;
  }

  /**
   * Sets the rotation of the layer.
   * @param {number} [rotate] - The rotation angle in degrees.
   * @returns {this} The current instance for chaining.
   */
  setRotate(rotate: number): this {
    this.props.transform = { ...this.props.transform, rotate };
    return this;
  }

  /**
   * Sets the translation of the layer in the x and y directions.
   * @param {number} [x] - The translation in the x direction.
   * @param {number} [y] - The translation in the y direction.
   * @returns {this} The current instance for chaining.
   */
  setTranslate(x: number, y: number): this {
    this.props.transform = { ...this.props.transform, translate: { x, y } };
    return this;
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
      props: this.props,
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

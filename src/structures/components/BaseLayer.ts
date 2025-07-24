import {
    ScaleType,
    AnyCentring,
    AnyGlobalCompositeOperation,
    ColorType,
    Transform,
    AnyFilter,
    Centring,
    LayerType
} from "../../types";
import { generateID, isColor } from "../../utils/utils";
import { LazyError } from "../../utils/LazyUtil";

/**
 * Interface representing the base structure of a layer.
 */
export interface IBaseLayer {
    /**
     * The unique identifier of the layer.
     */
    id: string;

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
     * The x-coordinate of the layer.
     */
    x: ScaleType;

    /**
     * The y-coordinate of the layer.
     */
    y: ScaleType;

    /**
     * The centring type of the layer.
     */
    centring: AnyCentring;

    /**
     * The filter effects applied to the layer.
     */
    filter?: string;

    /**
     * The opacity of the layer, ranging from 0 to 1.
     */
    opacity: number;

    /**
     * Whether the layer is filled.
     */
    filled: boolean;

    /**
     * The fill style (color or pattern) of the layer.
     */
    fillStyle: ColorType;

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
        offsetX: number;

        /**
         * The vertical offset of the shadow.
         */
        offsetY: number;
    };

    /**
     * The transformation properties of the layer.
     */
    transform: Transform;

    /**
     * The global composite operation applied to the layer.
     */
    globalComposite: AnyGlobalCompositeOperation;
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
export class BaseLayer<T extends IBaseLayerProps> {
    /**
     * The unique identifier of the layer.
     * @type {string}
     */
    id: string;
    /**
     * The type of the layer.
     * @type {LayerType}
     */
    type: LayerType;
    /**
     * The z-index of the layer, determining its stacking order.
     * @type {number}
     */
    zIndex: number;
    /**
     * The visibility of the layer.
     * @type {boolean}
     */
    visible: boolean;
    /**
     * The properties of the layer, defined by the generic type `T`.
     * @type {T}
     */
    props: T;

    /**
     * Constructs a new `BaseLayer` instance.
     * @param {LayerType} [type] - The type of the layer.
     * @param {T} [props] - The properties of the layer.
     * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
     */
    constructor(type?: LayerType, props?: T, misc?: IBaseLayerMisc) {
        this.id = misc?.id || generateID(type ? type : LayerType.Base);
        this.type = type ? type : LayerType.Base;
        this.zIndex = misc?.zIndex || 1;
        this.visible = misc?.visible || true;
        this.props = props ? props : {} as T;
        this.props = this.validateProps(this.props);
    }

    /**
     * Sets the position of the layer in the 2D plane.
     * @param {ScaleType} x - The x-coordinate of the layer.
     * @param {ScaleType} y - The y-coordinate of the layer.
     * @returns {this} The current instance for chaining.
     */
    setPosition(x: ScaleType, y: ScaleType): this {
        this.props.x = x;
        this.props.y = y;
        return this;
    }

    /**
     * Sets the opacity of the layer.
     * @param {number} opacity - The opacity value, between 0 and 1.
     * @returns {this} The current instance for chaining.
     */
    setOpacity(opacity: number): this {
        this.props.opacity = opacity;
        return this;
    }

    /**
     * Sets the unique identifier of the layer.
     *
     * @param {string} id - The unique identifier.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string): this {
        this.id = id;
        return this;
    }

    /**
     * Sets the shadow properties of the layer.
     * @param {string} color - The color of the shadow.
     * @param {number} [blur] - The blur radius of the shadow.
     * @param {number} [offsetX] - The horizontal offset of the shadow.
     * @param {number} [offsetY] - The vertical offset of the shadow.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the color is invalid or not provided.
     */
    setShadow(color: string, blur?: number, offsetX?: number, offsetY?: number): this {
        if (!color) throw new LazyError('The color of the shadow must be provided');
        if (!isColor(color)) throw new LazyError('The color of the shadow must be a valid color');
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
     * @param {DOMMatrix2DInit} matrix - The transformation matrix.
     * @returns {this} The current instance for chaining.
     */
    setMatrix(matrix: DOMMatrix2DInit): this {
        this.props.transform = { ...this.props.transform, matrix };
        return this;
    }

    /**
     * Sets the scale of the layer in the x and y directions.
     * @param {number} x - The scale factor in the x direction.
     * @param {number} y - The scale factor in the y direction.
     * @returns {this} The current instance for chaining.
     */
    setScale(x: number, y: number): this {
        this.props.transform = { ...this.props.transform, scale: { x, y } };
        return this;
    }

    /**
     * Sets the rotation of the layer.
     * @param {number} rotate - The rotation angle in degrees.
     * @returns {this} The current instance for chaining.
     */
    setRotate(rotate: number): this {
        this.props.transform = { ...this.props.transform, rotate };
        return this;
    }

    /**
     * Sets the translation of the layer in the x and y directions.
     * @param {number} x - The translation in the x direction.
     * @param {number} y - The translation in the y direction.
     * @returns {this} The current instance for chaining.
     */
    setTranslate(x: number, y: number): this {
        this.props.transform = { ...this.props.transform, translate: { x, y } };
        return this;
    }

    /**
     * Sets the filter effects for the layer.
     * @param {...AnyFilter} filter - The filter effects to apply.
     * @returns {this} The current instance for chaining.
     */
    setFilters(...filter: AnyFilter[]): this {
        this.props.filter = filter.join(' ');
        return this;
    }

    /**
     * Sets the centring type of the layer. **Don't affect on Bezier, Line, Quadratic and Text layers**.
     * @param {AnyCentring} centring - The centring type.
     * @returns {this} The current instance for chaining.
     */
    setCentring(centring: AnyCentring): this {
        this.props.centring = centring;
        return this;
    }

    /**
     * Sets the visibility of the layer.
     * @param {boolean} visible - The visibility state.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the layer.
     * @param {number} zIndex - The z-index value.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number): this {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Sets the global composite operation for the layer.
     * @param {AnyGlobalCompositeOperation} operation - The composite operation.
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
            x: data.x || 0,
            y: data.y || 0,
            centring: data.centring || Centring.Center,
            filter: data.filter || '',
            opacity: data.opacity || 1,
            filled: data.filled || true,
            fillStyle: data.fillStyle || '#000000',
            transform: data.transform || {},
            globalComposite: data.globalComposite || 'source-over',
        };
    }
}
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
import { generateID, isColor, parseColor } from "../../utils/utils";
import { LazyError } from "../../utils/LazyUtil";

export interface IBaseLayer{
    id: string;
    type: LayerType;
    zIndex: number;
    visible: boolean;
    props: IBaseLayerProps;
}

export interface IBaseLayerProps {
    x: ScaleType;
    y: ScaleType;
    centring: AnyCentring;
    filter: string;
    opacity: number;
    filled: boolean;
    fillStyle: ColorType;
    stroke: {
        width: number;
        cap: CanvasLineCap;
        join: CanvasLineJoin;
        dashOffset: number;
        dash: number[];
        miterLimit: number;
    };
    shadow: {
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    transform: Transform;
    globalComposite: AnyGlobalCompositeOperation;
}

export interface IBaseLayerMisc {
    id?: string;
    zIndex?: number;
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
        if (!this.props.x) this.props.x = 0;
        if (!this.props.y) this.props.y = 0;
        if (!this.props.opacity) this.props.opacity = 1;
        if (!this.props.centring) this.props.centring = Centring.Center;
        if (!this.props.transform) this.props.transform = {} as Transform;
    }

    /**
     * Sets the position of the layer in the 2D plane.
     * @param {ScaleType} x - The x-coordinate of the layer.
     * @param {ScaleType} y - The y-coordinate of the layer.
     * @returns {this} The current instance for chaining.
     */
    setPosition(x: ScaleType, y: ScaleType) {
        this.props.x = x;
        this.props.y = y;
        return this;
    }

    /**
     * Sets the opacity of the layer.
     * @param {number} opacity - The opacity value, between 0 and 1.
     * @returns {this} The current instance for chaining.
     */
    setOpacity(opacity: number) {
        this.props.opacity = opacity;
        return this;
    }

    /**
     * Sets the unique identifier of the layer.
     *
     * @param {string} id - The unique identifier.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string) {
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
    setShadow(color: string, blur?: number, offsetX?: number, offsetY?: number) {
        if (!color) throw new LazyError('The color of the shadow must be provided');
        if (!isColor(color)) throw new LazyError('The color of the shadow must be a valid color');
        let parse = parseColor(color) as string;
        this.props.shadow = {
            color: parse,
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
    setMatrix(matrix: DOMMatrix2DInit) {
        this.props.transform = { ...this.props.transform, matrix };
        return this;
    }

    /**
     * Sets the scale of the layer in the x and y directions.
     * @param {number} x - The scale factor in the x direction.
     * @param {number} y - The scale factor in the y direction.
     * @returns {this} The current instance for chaining.
     */
    setScale(x: number, y: number) {
        this.props.transform = { ...this.props.transform, scale: { x, y } };
        return this;
    }

    /**
     * Sets the rotation of the layer.
     * @param {number} rotate - The rotation angle in degrees.
     * @returns {this} The current instance for chaining.
     */
    setRotate(rotate: number) {
        this.props.transform = { ...this.props.transform, rotate };
        return this;
    }

    /**
     * Sets the translation of the layer in the x and y directions.
     * @param {number} x - The translation in the x direction.
     * @param {number} y - The translation in the y direction.
     * @returns {this} The current instance for chaining.
     */
    setTranslate(x: number, y: number) {
        this.props.transform = { ...this.props.transform, translate: { x, y } };
        return this;
    }

    /**
     * Sets the filter effects for the layer.
     * @param {...AnyFilter} filter - The filter effects to apply.
     * @returns {this} The current instance for chaining.
     */
    setFilters(...filter: AnyFilter[]) {
        this.props.filter = filter.join(' ');
        return this;
    }

    /**
     * Sets the centring type of the layer. **Don't affect on Bezier, Line, Quadratic and Text layers**.
     * @param {AnyCentring} centring - The centring type.
     * @returns {this} The current instance for chaining.
     */
    setCentring(centring: AnyCentring) {
        this.props.centring = centring;
        return this;
    }

    /**
     * Sets the visibility of the layer.
     * @param {boolean} visible - The visibility state.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the layer.
     * @param {number} zIndex - The z-index value.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number) {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Sets the global composite operation for the layer.
     * @param {AnyGlobalCompositeOperation} operation - The composite operation.
     * @returns {this} The current instance for chaining.
     */
    setGlobalCompositeOperation(operation: AnyGlobalCompositeOperation) {
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
}
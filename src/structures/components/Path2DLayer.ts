import {
    Path2D,
    PathOp,
    FillType,
    StrokeOptions,
    DOMMatrix2DInit,
    SKRSContext2D,
    Canvas,
    SvgCanvas
} from "@napi-rs/canvas";
import { AnyGlobalCompositeOperation, ColorType, Transform, LayerType, AnyFilter } from "../../types";
import {generateID, parseFillStyle, transform, opacity, isColor, parseColor} from "../../utils/utils";
import { IBaseLayerMisc } from "./BaseLayer";
import { LayersManager } from "../managers/LayersManager";
import {LazyError} from "../../utils/LazyUtil";
import {Gradient, Pattern} from "../helpers";

export interface IPath2DLayer {
    id: string;
    type: LayerType.Path;
    zIndex: number;
    visible: boolean;
    props: IPath2DLayerProps;
}

export interface IPath2DLayerProps {
    path2D: Path2D;
    /**
     * The filter effects applied to the layer.
     */
    filter: string;

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
     * The transformation properties of the layer.
     */
    transform: Transform;

    /**
     * The global composite operation applied to the layer.
     */
    globalComposite: AnyGlobalCompositeOperation;

    /**
     * The stroke properties of the Path2D.
     */
    stroke: {
        /**
         * The width of the stroke.
         */
        width: number;

        /**
         * The cap style of the stroke.
         */
        cap: CanvasLineCap;

        /**
         * The join style of the stroke.
         */
        join: CanvasLineJoin;

        /**
         * The dash offset of the stroke.
         */
        dashOffset: number;

        /**
         * The dash pattern of the stroke.
         */
        dash: number[];

        /**
         * The miter limit of the stroke.
         */
        miterLimit: number;
    };

    loadFromSVG: boolean;
    clipPath: boolean;
}

export class Path2DLayer implements IPath2DLayer {
    id: string;
    type: LayerType.Path = LayerType.Path;
    zIndex: number;
    visible: boolean;
    props: IPath2DLayerProps;

    constructor(props?: IPath2DLayerProps, misc?: IBaseLayerMisc) {
        this.id = misc?.id || generateID(LayerType.Path);
        this.zIndex = misc?.zIndex || 1;
        this.visible = misc?.visible || true;
        this.props = {
            path2D: props?.path2D || new Path2D(),
            filter: props?.filter || "",
            opacity: props?.opacity || 1,
            filled: props?.filled || true,
            fillStyle: props?.fillStyle || "#000000",
            transform: props?.transform || {} as Transform,
            globalComposite: props?.globalComposite || "source-over",
            stroke: {
                width: props?.stroke?.width || 1,
                cap: props?.stroke?.cap || "butt",
                join: props?.stroke?.join || "miter",
                dashOffset: props?.stroke?.dashOffset || 0,
                dash: props?.stroke?.dash || [],
                miterLimit: props?.stroke?.miterLimit || 10,
            },
            loadFromSVG: props?.loadFromSVG || false,
            clipPath: props?.clipPath || false,
        };

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
     * Sets the visibility of the layer.
     * @param visible {boolean} - The visibility state of the layer.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the layer.
     * @param zIndex {number} - The z-index value of the layer.
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
     * Sets the filter effects for the layer.
     * @param {...AnyFilter} filter - The filter effects to apply.
     * @returns {this} The current instance for chaining.
     */
    setFilters(...filter: AnyFilter[]) {
        this.props.filter = filter.join(' ');
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
     * Sets the opacity of the layer.
     * @param {number} opacity - The opacity value, between 0 and 1.
     * @returns {this} The current instance for chaining.
     */
    setOpacity(opacity: number) {
        this.props.opacity = opacity;
        return this;
    }

    /**
     * Sets the stroke properties of the Path2D Layer.
     * @param width {number} - The width of the stroke.
     * @param cap {string} - The cap style of the stroke.
     * @param join {string} - The join style of the stroke.
     * @param dash {number[]} - The dash pattern of the stroke.
     * @param dashOffset {number} - The dash offset of the stroke.
     * @param miterLimit {number} - The miter limit of the stroke.
     * @returns {this} The current instance for chaining.
     */
    setStroke(width: number, cap?: CanvasLineCap, join?: CanvasLineJoin, dash?: number[], dashOffset?: number, miterLimit?: number) {
        this.props.stroke = {
            width,
            cap: cap || 'butt',
            join: join || 'miter',
            dash: dash || [],
            dashOffset: dashOffset || 0,
            miterLimit: miterLimit || 10,
        };
        return this;
    }

    /**
     * Sets whether the Path2D Layer should be filled or stroked.
     * @param filled {boolean} - If true, the layer will be filled; otherwise, it will be stroked.
     * @returns {this} The current instance for chaining.
     */
    setFilled(filled: boolean) {
        this.props.filled = filled;
        return this;
    }

    /**
     * Sets the color of the Path2D Layer.
     * @param color {string} - The color of the Path2D Layer.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the color is not provided or invalid.
     */
    setColor(color: ColorType) {
        if (!color) throw new LazyError('The color of the layer must be provided');
        if (!isColor(color)) throw new LazyError('The color of the layer must be a valid color');
        let fill = parseColor(color);
        if (fill instanceof Gradient || fill instanceof Pattern) {
            this.props.fillStyle = fill;
        } else {
            let arr = fill.split(':');
            this.props.fillStyle = arr[0];
            this.props.opacity = parseFloat(arr[1]) || 1;
        }
        return this;
    }

    setPath(path: Path2D | string) {
        this.props.path2D = path instanceof Path2D ? path : new Path2D(path);
        return this;
    }

    loadFromSVG(path: true) {
        this.props.loadFromSVG = path;
        return this;
    }

    setClipPath(clipPath: boolean) {
        this.props.clipPath = clipPath;
        return this;
    }

    toSVGString() {
        return this.props.path2D.toSVGString();
    }

    addPath(path: Path2D, transform?: DOMMatrix2DInit | undefined) {
        this.props.path2D.addPath(path, transform);
        return this;
    }

    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
        this.props.path2D.arc(x, y, radius, startAngle, endAngle, anticlockwise);
        return this;
    }

    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
        this.props.path2D.arcTo(x1, y1, x2, y2, radius);
        return this;
    }

    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
        this.props.path2D.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        return this;
    }

    closePath() {
        this.props.path2D.closePath();
        return this;
    }

    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
        this.props.path2D.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
        return this;
    }

    lineTo(x: number, y: number) {
        this.props.path2D.lineTo(x, y);
        return this;
    }

    moveTo(x: number, y: number) {
        this.props.path2D.moveTo(x, y);
        return this;
    }

    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
        this.props.path2D.quadraticCurveTo(cpx, cpy, x, y);
        return this;
    }

    rect(x: number, y: number, width: number, height: number) {
        this.props.path2D.rect(x, y, width, height);
        return this;
    }

    stroke(stroke?: StrokeOptions) {
        this.props.path2D.stroke(stroke);
        return this;
    }

    op(path: Path2D, op: PathOp) {
        this.props.path2D.op(path, op);
        return this;
    }

    getFillType() {
        return this.props.path2D.getFillType();
    }

    getFillTypeString() {
        return this.props.path2D.getFillTypeString();
    }

    setFillType(fillType: FillType) {
        this.props.path2D.setFillType(fillType);
        return this;
    }

    simplify() {
        this.props.path2D.simplify();
        return this;
    }

    asWinding() {
        this.props.path2D.asWinding();
        return this;
    }

    transform(matrix: DOMMatrix2DInit) {
        this.props.path2D.transform(matrix);
        return this;
    }

    getBounds() {
        return this.props.path2D.getBounds();
    }

    computeTightBounds() {
        return this.props.path2D.computeTightBounds();
    }

    trim(start: number, end: number, isComplement?: boolean) {
        this.props.path2D.trim(start, end, isComplement);
        return this;
    }

    equals(path: Path2DLayer) {
        return this.props.path2D.equals(path.props.path2D);
    }

    roundRect(x: number, y: number, width: number, height: number, radius: number) {
        this.props.path2D.roundRect(x, y, width, height, radius);
        return this;
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        ctx.beginPath();
        ctx.save();
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);
        transform(ctx, this.props.transform, { width: 0, height: 0, x: 0, y: 0, type: this.type });
        opacity(ctx, this.props.opacity);
        ctx.globalCompositeOperation = this.props.globalComposite;
        if (this.props.clipPath) {
            ctx.clip(this.props.path2D);
        } else if (this.props.filled) {
            ctx.fillStyle = fillStyle;
            ctx.fill(this.props.path2D);
        } else {
            ctx.strokeStyle = fillStyle;
            ctx.lineWidth = this.props.stroke.width;
            ctx.lineCap = this.props.stroke.cap;
            ctx.lineJoin = this.props.stroke.join;
            ctx.miterLimit = this.props.stroke.miterLimit;
            ctx.lineDashOffset = this.props.stroke.dashOffset;
            ctx.setLineDash(this.props.stroke.dash);
            ctx.stroke(this.props.path2D);
        }
        ctx.restore();
        ctx.closePath();
    }

    /**
     * Converts the Path2D Layer to a JSON representation.
     * @returns {IPath2DLayer} The JSON representation of the Path2D Layer.
     */
    toJSON(): IPath2DLayer {
        return {
            id: this.id,
            type: this.type,
            zIndex: this.zIndex,
            visible: this.visible,
            props: this.props
        };
    }
}

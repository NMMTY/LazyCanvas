import {
    Canvas,
    DOMMatrix2DInit,
    FillType,
    Path2D,
    PathOp,
    SKRSContext2D,
    StrokeOptions,
    SvgCanvas
} from "@napi-rs/canvas";
import { AnyFilter, AnyGlobalCompositeOperation, ColorType, LayerType } from "../../types";
import { generateID, isColor, opacity, parseFillStyle, transform } from "../../utils/utils";
import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { LayersManager } from "../managers";
import { LazyError } from "../../utils/LazyUtil";

export interface IPath2DLayer extends IBaseLayer {
    type: LayerType.Path;
    props: IPath2DLayerProps;
}

export interface IPath2DLayerProps extends IBaseLayerProps {
    path2D: Path2D;

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

export class Path2DLayer extends BaseLayer<IPath2DLayerProps> {
    id: string;
    type: LayerType.Path = LayerType.Path;
    zIndex: number;
    visible: boolean;
    props: IPath2DLayerProps;

    constructor(props?: IPath2DLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Path, props || {} as IPath2DLayerProps, misc);
        this.id = misc?.id || generateID(LayerType.Path);
        this.zIndex = misc?.zIndex || 1;
        this.visible = misc?.visible || true;
        this.props = props ? props : {} as IPath2DLayerProps;
        this.props = this.validateProps(this.props);

    }

    /**
     * Sets the color of the Path2D Layer.
     * @param {ColorType} [color] - The color of the layer.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the color is not provided or invalid.
     */
    setColor(color: ColorType): this {
        if (!color) throw new LazyError('The color of the layer must be provided');
        if (!isColor(color)) throw new LazyError('The color of the layer must be a valid color');
        this.props.fillStyle = color;
        return this;
    }

    setPath(path: Path2D | string): this {
        this.props.path2D = path instanceof Path2D ? path : new Path2D(path);
        return this;
    }

    loadFromSVG(path: true): this {
        this.props.loadFromSVG = path;
        return this;
    }

    setClipPath(clipPath: boolean): this {
        this.props.clipPath = clipPath;
        return this;
    }

    toSVGString(): string {
        return this.props.path2D.toSVGString();
    }

    addPath(path: Path2D, transform?: DOMMatrix2DInit | undefined): this {
        this.props.path2D.addPath(path, transform);
        return this;
    }

    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): this {
        this.props.path2D.arc(x, y, radius, startAngle, endAngle, anticlockwise);
        return this;
    }

    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): this {
        this.props.path2D.arcTo(x1, y1, x2, y2, radius);
        return this;
    }

    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this {
        this.props.path2D.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        return this;
    }

    closePath(): this {
        this.props.path2D.closePath();
        return this;
    }

    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean): this {
        this.props.path2D.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
        return this;
    }

    lineTo(x: number, y: number): this {
        this.props.path2D.lineTo(x, y);
        return this;
    }

    moveTo(x: number, y: number): this {
        this.props.path2D.moveTo(x, y);
        return this;
    }

    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
        this.props.path2D.quadraticCurveTo(cpx, cpy, x, y);
        return this;
    }

    rect(x: number, y: number, width: number, height: number): this {
        this.props.path2D.rect(x, y, width, height);
        return this;
    }

    stroke(stroke?: StrokeOptions): this {
        this.props.path2D.stroke(stroke);
        return this;
    }

    op(path: Path2D, op: PathOp): this {
        this.props.path2D.op(path, op);
        return this;
    }

    getFillType(): FillType {
        return this.props.path2D.getFillType();
    }

    getFillTypeString(): string {
        return this.props.path2D.getFillTypeString();
    }

    setFillType(fillType: FillType): this {
        this.props.path2D.setFillType(fillType);
        return this;
    }

    simplify(): this {
        this.props.path2D.simplify();
        return this;
    }

    asWinding(): this {
        this.props.path2D.asWinding();
        return this;
    }

    transform(matrix: DOMMatrix2DInit): this {
        this.props.path2D.transform(matrix);
        return this;
    }

    getBounds(): [left: number, top: number, right: number, bottom: number] {
        return this.props.path2D.getBounds();
    }

    computeTightBounds(): [left: number, top: number, right: number, bottom: number] {
        return this.props.path2D.computeTightBounds();
    }

    trim(start: number, end: number, isComplement?: boolean): this {
        this.props.path2D.trim(start, end, isComplement);
        return this;
    }

    equals(path: Path2DLayer): boolean {
        return this.props.path2D.equals(path.props.path2D);
    }

    roundRect(x: number, y: number, width: number, height: number, radius: number): this {
        this.props.path2D.roundRect(x, y, width, height, radius);
        return this;
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        ctx.beginPath();
        ctx.save();
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle, { debug, manager });
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

    /**
     * Validates the properties of the Path2D Layer.
     * @param {IPath2DLayerProps} [data] - The properties to validate.
     * @returns {IPath2DLayerProps} The validated properties.
     */
    protected validateProps(data: IPath2DLayerProps): IPath2DLayerProps {
        return {
            ...super.validateProps(data),
            path2D: data.path2D || new Path2D(),
            stroke: {
                width: data.stroke?.width || 1,
                cap: data.stroke?.cap || 'butt',
                join: data.stroke?.join || 'miter',
                dashOffset: data.stroke?.dashOffset || 0,
                dash: data.stroke?.dash || [],
                miterLimit: data.stroke?.miterLimit || 10
            },
            loadFromSVG: data.loadFromSVG || false,
            clipPath: data.clipPath || false
        };
    }
}

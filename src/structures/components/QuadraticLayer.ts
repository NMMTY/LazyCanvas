import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType, Point, Centring, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseColor,
    transform,
    parseFillStyle,
    getBoundingBoxBezier,
    parser
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { Gradient, Pattern } from "../helpers";
import { LayersManager } from "../managers/LayersManager";

/**
 * Interface representing a Quadratic Layer.
 */
export interface IQuadraticLayer extends IBaseLayer {
    /**
     * The type of the layer, which is `QuadraticCurve`.
     */
    type: LayerType.QuadraticCurve;

    /**
     * The properties specific to the Quadratic Layer.
     */
    props: IQuadraticLayerProps;
}

/**
 * Interface representing the properties of a Quadratic Layer.
 */
export interface IQuadraticLayerProps extends IBaseLayerProps {
    /**
     * The control point of the quadratic curve, including x and y coordinates.
     */
    controlPoint: Point;

    /**
     * The end point of the quadratic curve, including x and y coordinates.
     */
    endPoint: Point;
}

/**
 * Class representing a Quadratic Layer, extending the BaseLayer class.
 */
export class QuadraticLayer extends BaseLayer<IQuadraticLayerProps> {
    /**
     * The properties of the Quadratic Layer.
     */
    props: IQuadraticLayerProps;

    /**
     * Constructs a new QuadraticLayer instance.
     * @param props {IQuadraticLayerProps} - The properties of the Quadratic Layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: IQuadraticLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.QuadraticCurve, props || {} as IQuadraticLayerProps, misc);
        this.props = props ? props : {} as IQuadraticLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        this.props.centring = Centring.None;
    }

    /**
     * Sets the control point of the quadratic layer.
     * @param x {ScaleType} - The x-coordinate of the control point.
     * @param y {ScaleType} - The y-coordinate of the control point.
     * @returns {this} The current instance for chaining.
     */
    setControlPoint(x: ScaleType, y: ScaleType) {
        this.props.controlPoint = { x, y };
        return this;
    }

    /**
     * Sets the end point of the quadratic layer.
     * @param x {ScaleType} - The x-coordinate of the end point.
     * @param y {ScaleType} - The y-coordinate of the end point.
     * @returns {this} The current instance for chaining.
     */
    setEndPosition(x: ScaleType, y: ScaleType) {
        this.props.endPoint = { x, y };
        return this;
    }

    /**
     * Sets the color of the layer.
     * @param color {ColorType} - The color of the layer.
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

    /**
     * Sets the stroke properties of the layer.
     * @param width {number} - The width of the stroke.
     * @param cap {CanvasLineCap} - The cap style of the stroke.
     * @param join {CanvasLineJoin} - The join style of the stroke.
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
     * Calculates the bounding box of the quadratic curve.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @returns {Object} The bounding box details including max, min, center, width, and height.
     */
    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cx, cy, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cx: { v: this.props.controlPoint.x },
            cy: { v: this.props.controlPoint.y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cx, y: cy }, { x: xe, y: ye } ]);
        return { max, min, center, width, height };
    }

    /**
     * Draws the quadratic curve on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cx, cy, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cx: { v: this.props.controlPoint.x },
            cy: { v: this.props.controlPoint.y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cx, y: cy }, { x: xe, y: ye } ]);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);

        if (debug) LazyLog.log('none', `BezierLayer:`, { xs, ys, cx, cy, xe, ye, max, min, center, width, height, fillStyle });

        ctx.save();

        transform(ctx, this.props.transform, { x: center.x, y: center.y, width, height, type: this.type });
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);

        ctx.beginPath();
        ctx.moveTo(xs, ys);
        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = this.props.stroke?.width || 1;
        ctx.lineCap = this.props.stroke?.cap || 'butt';
        ctx.lineJoin = this.props.stroke?.join || 'miter';
        ctx.miterLimit = this.props.stroke?.miterLimit || 10;
        ctx.lineDashOffset = this.props.stroke?.dashOffset || 0;
        ctx.setLineDash(this.props.stroke?.dash || []);
        ctx.quadraticCurveTo(cx, cy, xe, ye);
        ctx.stroke();
        ctx.closePath();

        ctx.restore();
    }

    /**
     * Converts the Quadratic Layer to a JSON representation.
     * @returns {IQuadraticLayer} The JSON representation of the Quadratic Layer.
     */
    public toJSON(): IQuadraticLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'endPoint.x', 'endPoint.y', 'controlPoint.x', 'controlPoint.y', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as IQuadraticLayer;
    }
}
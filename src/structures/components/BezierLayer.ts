import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, Point, ScaleType, Centring, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    getBoundingBoxBezier,
    isColor,
    opacity,
    parseColor,
    parseFillStyle,
    parser,
    transform
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { Gradient, Pattern } from "../helpers";
import { LayersManager } from "../managers/LayersManager";

/**
 * Interface representing a Bezier layer.
 */
export interface IBezierLayer extends IBaseLayer {
    /**
     * The type of the layer, which is a Bézier curve.
     */
    type: LayerType.BezierCurve;

    /**
     * The properties specific to the Bezier layer.
     */
    props: IBezierLayerProps;
}

/**
 * Interface representing the properties of a Bezier layer.
 */
export interface IBezierLayerProps extends IBaseLayerProps {
    /**
     * The control points of the Bézier curve.
     */
    controlPoints: Array<Point>;

    /**
     * The end point of the Bézier curve.
     */
    endPoint: Point;
}

/**
 * Class representing a Bezier layer, extending the BaseLayer class.
 */
export class BezierLayer extends BaseLayer<IBezierLayerProps> {
    /**
     * The properties of the Bezier layer.
     */
    props: IBezierLayerProps;

    /**
     * Constructs a new BezierLayer instance.
     * @param props {IBezierLayerProps} - The properties of the Bezier layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: IBezierLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.BezierCurve, props || {} as IBezierLayerProps, misc);
        this.props = props ? props : {} as IBezierLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        this.props.centring = Centring.None;
    }

    /**
     * Sets the control points of the Bezier layer.
     * @param controlPoints {Array<{ x: ScaleType, y: ScaleType }>} - The control points of the Bezier layer.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the number of control points is not exactly 2.
     */
    setControlPoints(...controlPoints: { x: ScaleType, y: ScaleType }[]) {
        if (controlPoints.length !== 2) throw new LazyError('The control points of the layer must be provided');
        this.props.controlPoints = controlPoints.flat();
        return this;
    }

    /**
     * Sets the end position of the Bezier layer.
     * @param x {ScaleType} - The x-coordinate of the end point.
     * @param y {ScaleType} - The y-coordinate of the end point.
     * @returns {this} The current instance for chaining.
     */
    setEndPosition(x: ScaleType, y: ScaleType) {
        this.props.endPoint = { x, y };
        return this;
    }

    /**
     * Sets the color of the Bezier layer.
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
     * Sets the stroke properties of the Bezier layer.
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
     * Calculates the bounding box of the Bezier layer.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @returns {Object} The bounding box details including max, min, center, width, and height.
     */
    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cp1x, cp1y, cp2x, cp2y, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cp1x: { v: this.props.controlPoints[0].x },
            cp1y: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
            cp2x: { v: this.props.controlPoints[1].x },
            cp2y: { v: this.props.controlPoints[1].y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, { x: xe, y: ye } ]);
        return { max, min, center, width, height };
    }

    /**
     * Draws the Bezier layer on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cp1x, cp1y, cp2x, cp2y, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cp1x: { v: this.props.controlPoints[0].x },
            cp1y: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
            cp2x: { v: this.props.controlPoints[1].x },
            cp2y: { v: this.props.controlPoints[1].y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, { x: xe, y: ye } ]);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);

        if (debug) LazyLog.log('none', `BezierLayer:`, { xs, ys, cp1x, cp1y, cp2x, cp2y, xe, ye, max, min, center, width, height, fillStyle });

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
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xe, ye);
        ctx.stroke();
        ctx.closePath();

        ctx.restore();
    }

    /**
     * Converts the Bezier layer to a JSON representation.
     * @returns {IBezierLayer} The JSON representation of the Bezier layer.
     */
    public toJSON(): IBezierLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'endPoint.x', 'endPoint.y', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        if (copy.controlPoints) {
            copy.controlPoints = copy.controlPoints.map((point: { x: ScaleType, y: ScaleType }) => {
                if (point.x && typeof point.x === 'object' && 'toJSON' in point.x) {
                    // @ts-ignore
                    point.x = point.x.toJSON();
                }
                if (point.y && typeof point.y === 'object' && 'toJSON' in point.y) {
                    // @ts-ignore
                    point.y = point.y.toJSON();
                }
                return point;
            });
        }

        return { ...data, props: copy } as IBezierLayer;
    }
}
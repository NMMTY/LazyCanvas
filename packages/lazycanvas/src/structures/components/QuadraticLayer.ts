import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType, Point, Centring, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    transform,
    parseFillStyle,
    getBoundingBoxBezier,
    parser
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { LayersManager } from "../managers";

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
    controlPoints: Array<Point>;

    /**
     * The end point of the quadratic curve, including x and y coordinates.
     */
    endPoint: Point;

    /**
     * Whether the layer is filled.
     */
    filled: boolean;

    /**
     * The fill style (color or pattern) of the layer.
     */
    fillStyle: ColorType;

    /**
     * The stroke properties of the quadratic curve.
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
     * @param {IQuadraticLayerProps} [props] - The properties of the Quadratic Layer.
     * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
     */
    constructor(props?: IQuadraticLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.QuadraticCurve, props || {} as IQuadraticLayerProps, misc);
        this.props = props ? props : {} as IQuadraticLayerProps;
        this.props = this.validateProps(this.props);
    }

    /**
     * Sets the control point of the quadratic layer.
     * @param {ScaleType} [x] - The x-coordinate of the control point.
     * @param {ScaleType} [y] - The y-coordinate of the control point.
     * @returns {this} The current instance for chaining.
     */
    setControlPoint(x: ScaleType, y: ScaleType) {
        this.props.controlPoints = [{ x, y }];
        return this;
    }

    /**
     * Sets the end point of the quadratic layer.
     * @param {ScaleType} [x] - The x-coordinate of the end point.
     * @param {ScaleType} [y] - The y-coordinate of the end point.
     * @returns {this} The current instance for chaining.
     */
    setEndPosition(x: ScaleType, y: ScaleType) {
        this.props.endPoint = { x, y };
        return this;
    }

    /**
     * Sets the color of the layer.
     * @param {ColorType} [color] - The color of the layer.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the color is not provided or invalid.
     */
    setColor(color: ColorType) {
        if (!color) throw new LazyError('The color of the layer must be provided');
        if (!isColor(color)) throw new LazyError('The color of the layer must be a valid color');
        this.props.fillStyle = color;
        return this;
    }

    /**
     * Sets the stroke properties of the layer.
     * @param {number} [width] - The width of the stroke.
     * @param {string} [cap] - The cap style of the stroke.
     * @param {string} [join] - The join style of the stroke.
     * @param {number[]} [dash] - The dash pattern of the stroke.
     * @param {number} [dashOffset] - The dash offset of the stroke.
     * @param {number} [miterLimit] - The miter limit of the stroke.
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
     * @param {SKRSContext2D} [ctx] - The canvas rendering context.
     * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
     * @param {LayersManager} [manager] - The layers manager.
     * @returns {Object} The bounding box details including max, min, center, width, and height.
     */
    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cx, cy, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cx: { v: this.props.controlPoints[0].x },
            cy: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cx, y: cy }, { x: xe, y: ye } ]);
        return { max, min, center, width, height };
    }

    /**
     * Draws the quadratic curve on the canvas.
     * @param {SKRSContext2D} [ctx] - The canvas rendering context.
     * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
     * @param {LayersManager} [manager] - The layers manager.
     * @param {boolean} [debug] - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, cx, cy, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            cx: { v: this.props.controlPoints[0].x },
            cy: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) }
        });

        const { max, min, center, width, height } = getBoundingBoxBezier([ { x: xs, y: ys }, { x: cx, y: cy }, { x: xe, y: ye } ]);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle, { debug, layer: { width, height, x: min.x, y: min.y, align: 'none' }, manager });

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

    /**
     * Validates the properties of the Quadratic Layer.
     * @param {IQuadraticLayerProps} [data] - The properties to validate.
     * @returns {IQuadraticLayerProps} The validated properties.
     */
    protected validateProps(data: IQuadraticLayerProps): IQuadraticLayerProps {
        return {
            ...super.validateProps(data),
            filled: data.filled || false,
            fillStyle: data.fillStyle || '#000000',
            centring: data.centring || Centring.None,
            controlPoints: data.controlPoints || [{ x: 0, y: 0 }],
            endPoint: data.endPoint || { x: 0, y: 0 },
            stroke: {
                width: data.stroke?.width || 1,
                cap: data.stroke?.cap || 'butt',
                join: data.stroke?.join || 'miter',
                dashOffset: data.stroke?.dashOffset || 0,
                dash: data.stroke?.dash || [],
                miterLimit: data.stroke?.miterLimit || 10,
            }
        }
    }
}
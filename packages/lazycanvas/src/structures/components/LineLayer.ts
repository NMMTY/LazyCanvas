import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType, Centring, LayerType } from "../../types";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseFillStyle,
    parser,
    transform
} from "../../utils/utils";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LayersManager } from "../managers";

/**
 * Interface representing a Line Layer.
 */
export interface ILineLayer extends IBaseLayer {
    /**
     * The type of the layer, which is `Line`.
     */
    type: LayerType.Line;

    /**
     * The properties specific to the Line Layer.
     */
    props: ILineLayerProps;
}

/**
 * Interface representing the properties of a Line Layer.
 */
export interface ILineLayerProps extends IBaseLayerProps {
    /**
     * The end point of the line, including x and y coordinates.
     */
    endPoint: {
        /**
         * The x-coordinate of the end point.
         */
        x: ScaleType;

        /**
         * The y-coordinate of the end point.
         */
        y: ScaleType;
    };

    /**
     * Whether the layer is filled.
     */
    filled: boolean;

    /**
     * The fill style (color or pattern) of the layer.
     */
    fillStyle: ColorType;

    /**
     * The stroke properties of the line.
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
 * Class representing a Line Layer, extending the BaseLayer class.
 */
export class LineLayer extends BaseLayer<ILineLayerProps> {
    /**
     * The properties of the Line Layer.
     */
    props: ILineLayerProps;

    /**
     * Constructs a new LineLayer instance.
     * @param {ILineLayerProps} [props] - The properties of the Line Layer.
     * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
     */
    constructor(props?: ILineLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Line, props || {} as ILineLayerProps, misc);
        this.props = props ? props : {} as ILineLayerProps;
        this.props = this.validateProps(this.props);
    }

    /**
     * Sets the end position of the line layer.
     * @param {ScaleType} [x] - The x-coordinate of the end point.
     * @param {ScaleType} [y] - The y-coordinate of the end point.
     * @returns {this} The current instance for chaining.
     */
    setEndPosition(x: ScaleType, y: ScaleType): this {
        this.props.endPoint = { x, y };
        return this;
    }

    /**
     * Sets the color of the line layer.
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

    /**
     * Sets the stroke properties of the line layer.
     * @param {number} [width] - The width of the stroke.
     * @param {string} [cap] - The cap style of the stroke.
     * @param {string} [join] - The join style of the stroke.
     * @param {number[]} [dash] - The dash pattern of the stroke.
     * @param {number} [dashOffset] - The dash offset of the stroke.
     * @param {number} [miterLimit] - The miter limit of the stroke.
     * @returns {this} The current instance for chaining.
     */
    setStroke(width: number, cap?: CanvasLineCap, join?: CanvasLineJoin, dash?: number[], dashOffset?: number, miterLimit?: number): this {
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
     * Calculates the bounding box of the line layer.
     * @param {SKRSContext2D} [ctx] - The canvas rendering context.
     * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
     * @param {LayersManager} [manager] - The layers manager.
     * @returns {Object} The bounding box details including start and end points, width, and height.
     */
    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager): { xs: number; ys: number; xe: number; ye: number; width: number; height: number } {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) },
        });

        let width = xe - xs;
        let height = ye - ys;
        return { xs, ys, xe, ye, width, height };
    }

    /**
     * Draws the line layer on the canvas.
     * @param {SKRSContext2D} [ctx] - The canvas rendering context.
     * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
     * @param {LayersManager} [manager] - The layers manager.
     * @param {boolean} [debug] - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) },
        });

        let width = Math.abs(xe - xs);
        let height = Math.abs(ye - ys);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle, { debug, layer: { width, height, x: Math.min(xs, xe), y: Math.min(ys, ye), align: 'none' }, manager });

        if (debug) LazyLog.log('none', `LineLayer:`, { xs, ys, xe, ye, width, height });

        ctx.save();

        transform(ctx, this.props.transform, { x: xs, y: ys, width, height, type: this.type });
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
        ctx.lineTo(xe, ye);
        ctx.stroke();
        ctx.closePath();

        ctx.restore();
    }

    /**
     * Converts the Line Layer to a JSON representation.
     * @returns {ILineLayer} The JSON representation of the Line Layer.
     */
    toJSON(): ILineLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'endPoint.x', 'endPoint.y', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as ILineLayer;
    }

    /**
     * Validates the properties of the Line Layer.
     * @param {ILineLayerProps} [data] - The properties to validate.
     * @returns {ILineLayerProps} The validated properties.
     */
    protected validateProps(data: ILineLayerProps): ILineLayerProps {
        return {
            ...super.validateProps(data),
            filled: data.filled || false,
            fillStyle: data.fillStyle || '#000000',
            centring: data.centring || Centring.None,
            endPoint: {
                x: data.endPoint?.x || 0,
                y: data.endPoint?.y || 0,
            },
            stroke: {
                width: data.stroke?.width || 1,
                cap: data.stroke?.cap || 'butt',
                join: data.stroke?.join || 'miter',
                dashOffset: data.stroke?.dashOffset || 0,
                dash: data.stroke?.dash || [],
                miterLimit: data.stroke?.miterLimit || 10,
            },
        }
    }
}
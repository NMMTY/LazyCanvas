import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType, Centring, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    transform,
    centring,
    parseFillStyle, parser
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { LayersManager } from "../managers/LayersManager";

/**
 * Interface representing a Morph Layer.
 */
export interface IMorphLayer extends IBaseLayer {
    /**
     * The type of the layer, which is `Morph`.
     */
    type: LayerType.Morph;

    /**
     * The properties specific to the Morph Layer.
     */
    props: IMorphLayerProps;
}

/**
 * Interface representing the properties of a Morph Layer.
 */
export interface IMorphLayerProps extends IBaseLayerProps {
    /**
     * The size of the Morph Layer, including width, height, and radius.
     */
    size: {
        /**
         * The width of the Morph Layer.
         */
        width: ScaleType;

        /**
         * The height of the Morph Layer.
         */
        height: ScaleType;

        /**
         * The radius of the Morph Layer.
         */
        radius: ScaleType;
    };

    /**
     * The stroke properties of the morph.
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
 * Class representing a Morph Layer, extending the BaseLayer class.
 */
export class MorphLayer extends BaseLayer<IMorphLayerProps> {
    /**
     * The properties of the Morph Layer.
     */
    props: IMorphLayerProps;

    /**
     * Constructs a new MorphLayer instance.
     * @param props {IMorphLayerProps} - The properties of the Morph Layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: IMorphLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Morph, props || {} as IMorphLayerProps, misc);
        this.props = props ? props : {} as IMorphLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        if (!this.props.filled && this.props.filled !== false) this.props.filled = true;
        this.props.centring = Centring.Center;
    }

    /**
     * Sets the size of the Morph Layer.
     * @param width {ScaleType} - The width of the Morph Layer.
     * @param height {ScaleType} - The height of the Morph Layer.
     * @param radius {ScaleType} - The radius of the Morph Layer (optional).
     * @returns {this} The current instance for chaining.
     */
    setSize(width: ScaleType, height: ScaleType, radius?: ScaleType): this {
        this.props.size = {
            width: width,
            height: height,
            radius: radius || 0,
        };
        return this;
    }

    /**
     * Sets the color of the Morph Layer.
     * @param color {string} - The color of the Morph Layer.
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
     * Sets the stroke properties of the Morph Layer.
     * @param width {number} - The width of the stroke.
     * @param cap {string} - The cap style of the stroke.
     * @param join {string} - The join style of the stroke.
     * @param dash {number[]} - The dash pattern of the stroke.
     * @param dashOffset {number} - The dash offset of the stroke.
     * @param miterLimit {number} - The miter limit of the stroke.
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
     * Sets whether the Morph Layer should be filled or stroked.
     * @param filled {boolean} - If true, the layer will be filled; otherwise, it will be stroked.
     * @returns {this} The current instance for chaining.
     */
    setFilled(filled: boolean): this {
        this.props.filled = filled;
        return this;
    }

    /**
     * Draws the Morph Layer on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width },
        });

        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));
        const r = parcer.parse(this.props.size.radius, defaultArg.wh(w / 2, h / 2), defaultArg.vl(false, true));

        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);

        if (debug) LazyLog.log('none', `MorphLayer:`, { x, y, w, h, r });

        ctx.save();

        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
        ctx.beginPath();
        if (r) {
            ctx.moveTo(x + (w / 2), y);
            ctx.arcTo(x + w, y, x + w, y + (h / 2), r);
            ctx.arcTo(x + w, y + h, x + (w / 2), y + h, r);
            ctx.arcTo(x, y + h, x, y + (h / 2), r);
            ctx.arcTo(x, y, x + (w / 2), y, r);
        } else {
            ctx.rect(x, y, w, h);
        }
        ctx.closePath();

        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);

        if (this.props.filled) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        } else {
            ctx.strokeStyle = fillStyle;
            ctx.lineWidth = this.props.stroke?.width || 1;
            ctx.lineCap = this.props.stroke?.cap || 'butt';
            ctx.lineJoin = this.props.stroke?.join || 'miter';
            ctx.miterLimit = this.props.stroke?.miterLimit || 10;
            ctx.lineDashOffset = this.props.stroke?.dashOffset || 0;
            ctx.setLineDash(this.props.stroke?.dash || []);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Converts the Morph Layer to a JSON representation.
     * @returns {IMorphLayer} The JSON representation of the Morph Layer.
     */
    toJSON(): IMorphLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height', 'size.radius', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as IMorphLayer;
    }
}
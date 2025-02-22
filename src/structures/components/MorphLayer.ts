import { BaseLayer } from "./BaseLayer";
import { IMorphLayer, IMorphLayerProps, ColorType, ScaleType } from "../../types";
import { Centring, LayerType } from "../../types/enum";
import { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseColor,
    parseToNormal,
    transform,
    centring,
    parseFillStyle
} from "../../utils/utils";
import {LazyError, LazyLog} from "../../utils/LazyUtil";
import { Gradient } from "../helpers/Gradient";
import { Pattern } from "../helpers/Pattern";
import {LayersManager} from "../managers/LayersManager";

export class MorphLayer extends BaseLayer<IMorphLayerProps> {
    props: IMorphLayerProps;

    constructor(props?: IMorphLayerProps) {
        super(LayerType.Morph, props);
        this.props = props ? props : {} as IMorphLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        if (!this.props.filled && this.props.filled !== false) this.props.filled = true;
        this.props.centring = Centring.Center;
    }

    /**
     * @description Sets size of the morph layer. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param width {ScaleType} - The `width` of the morph layer.
     * @param height {ScaleType} - The `height` of the morph layer.
     * @param radius {ScaleType} - The `radius` of the morph layer. (optional)
     */
    setSize(width: ScaleType, height: ScaleType, radius?: ScaleType) {
        this.props.size = {
            width: width,
            height: height,
            radius: radius || 0,
        };
        return this;
    }

    /**
     * @description Sets the color of the layer. You can use `hex`, `rgb`, `rgba`, `hsl`, `hsla`, and `Gradient`color.
     * @param color {string} - The `color` of the layer.
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
     * @description Sets the stroke of the layer.
     * @param width {number} - The `width` of the stroke.
     * @param cap {string} - The `cap` of the stroke.
     * @param join {string} - The `join` of the stroke.
     * @param dash {number[]} - The `dash` of the stroke.
     * @param dashOffset {number} - The `dashOffset` of the stroke.
     * @param miterLimit {number} - The `miterLimit` of the stroke.
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
     * @description Sets the fills of the layer. If `true` the layer will be filled, if `false` the layer will be stroked.
     * @param filled {boolean} - The `filled` of the layer.
     */
    setFilled(filled: boolean) {
        this.props.filled = filled;
        return this;
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager, debug: boolean) {
        const xs = parseToNormal(this.props.x, ctx, canvas);
        const ys = parseToNormal(this.props.y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
        const w = parseToNormal(this.props.size.width, ctx, canvas, { width: 0, height: 0 }, { vertical: false }, manager);
        const h = parseToNormal(this.props.size.height, ctx, canvas, { width: w, height: 0 }, { vertical: true }, manager);
        const r = parseToNormal(this.props.size.radius, ctx, canvas, { width: w / 2, height: h / 2 }, { layer: true });
        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);

        if (debug) LazyLog.log('none', `MorphLayer:`, { x, y, w, h, r });

        ctx.save();

        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
        ctx.beginPath();
        if (r) {
            ctx.moveTo(x + (w /2), y);
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
     * @returns {IMorphLayer}
     */
    toJSON(): IMorphLayer {
        let data = super.toJSON();
        data.props = this.props;
        return { ...data } as IMorphLayer;
    }
}

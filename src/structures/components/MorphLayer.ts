import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType, Centring, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseColor,
    transform,
    centring,
    parseFillStyle, parser
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { Gradient, Pattern } from "../helpers";
import { LayersManager } from "../managers/LayersManager";

export interface IMorphLayer extends IBaseLayer {
    props: IMorphLayerProps;
}

export interface IMorphLayerProps extends IBaseLayerProps {
    size: {
        width: ScaleType;
        height: ScaleType;
        radius: ScaleType;
    };
}


export class MorphLayer extends BaseLayer<IMorphLayerProps> {
    props: IMorphLayerProps;

    constructor(props?: IMorphLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Morph, props || {} as IMorphLayerProps, misc);
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

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width },
        })

        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

        const r = parcer.parse(this.props.size.radius, defaultArg.wh(w / 2, h / 2), defaultArg.vl(false, true))

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
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height', 'size.radius', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as IMorphLayer;
    }
}

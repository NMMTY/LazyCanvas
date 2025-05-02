import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, ScaleType } from "../../types";
import { Centring, LayerType } from "../../types/enum";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseColor,
    parseFillStyle,
    parser,
    transform
} from "../../utils/utils";
import { Gradient, Pattern } from "../helpers";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LayersManager } from "../managers/LayersManager";

export interface ILineLayer extends IBaseLayer {
    props: ILineLayerProps;
}

export interface ILineLayerProps extends IBaseLayerProps {
    endPoint: {
        x: ScaleType,
        y: ScaleType
    }
}

export class LineLayer extends BaseLayer<ILineLayerProps> {
    props: ILineLayerProps;

    constructor(props?: ILineLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Line, props || {} as ILineLayerProps, misc);
        this.props = props ? props : {} as ILineLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        this.props.centring = Centring.None;
    }

    /**
     * @description Sets the end point of the line layer. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param x {ScaleType} - The end `x` of the line layer.
     * @param y {ScaleType} - The end `y` of the line layer.
     */
    setEndPosition(x: ScaleType, y: ScaleType) {
        this.props.endPoint = { x, y };
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

    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager) {
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

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, xe, ye } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            xe: { v: this.props.endPoint.x },
            ye: { v: this.props.endPoint.y, options: defaultArg.vl(true) },
        });

        let width = xe - xs;
        let height = ye - ys;
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle);

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

}
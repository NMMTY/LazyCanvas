import { BaseLayer } from "./BaseLayer";
import { ColorType, IBezierLayer, IBezierLayerProps, ScaleType } from "../../types";
import { Centring, LayerType } from "../../types/enum";
import { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import {
    drawShadow,
    filters,
    getBoundingBoxBezier,
    isColor,
    opacity,
    parseColor,
    parseFillStyle,
    parseToNormal,
    transform
} from "../../utils/utils";
import { LazyError, LazyLog } from "../../utils/LazyUtil";
import { Gradient } from "../helpers/Gradient";
import { Pattern } from "../helpers/Pattern";
import { LayersManager } from "../managers/LayersManager";

export class BezierLayer extends BaseLayer<IBezierLayerProps> {
    props: IBezierLayerProps;

    constructor(props?: IBezierLayerProps) {
        super(LayerType.BezierCurve, props || {} as IBezierLayerProps);
        this.props = props ? props : {} as IBezierLayerProps;
        if (!this.props.fillStyle) this.props.fillStyle = '#000000';
        this.props.centring = Centring.None;
    }

    /**
     * @description Sets the control points of the bezier layer. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param controlPoints {Array<{ x: ScaleType, y: ScaleType }>} - The `controlPoints` of the bezier layer.
     */
    setControlPoints(...controlPoints: { x: ScaleType, y: ScaleType }[]) {
        if (controlPoints.length !== 2) throw new LazyError('The control points of the layer must be provided');
        this.props.controlPoints = controlPoints.flat();
        return this;
    }

    /**
     * @description Sets the end point of the bezier layer. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param x {ScaleType} - The end `x` of the bezier layer.
     * @param y {ScaleType} - The end `y` of the bezier layer.
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

    async draw(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager, debug: boolean) {
        const xs = parseToNormal(this.props.x, ctx, canvas);
        const ys = parseToNormal(this.props.y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
        const cp1x = parseToNormal(this.props.controlPoints[0].x, ctx, canvas);
        const cp1y = parseToNormal(this.props.controlPoints[0].y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
        const cp2x = parseToNormal(this.props.controlPoints[1].x, ctx, canvas);
        const cp2y = parseToNormal(this.props.controlPoints[1].y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
        const xe = parseToNormal(this.props.endPoint.x, ctx, canvas);
        const ye = parseToNormal(this.props.endPoint.y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
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
     * @returns {IBezierLayer}
     */
    public toJSON(): IBezierLayer {
        let data = super.toJSON();
        data.props = this.props;
        return {...data} as IBezierLayer;
    }
}
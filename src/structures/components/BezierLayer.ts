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
    parser,
    transform
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
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

    getBoundingBox(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager) {
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

    async draw(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager, debug: boolean) {
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
     * @returns {IBezierLayer}
     */
    public toJSON(): IBezierLayer {
        let data = super.toJSON();
        data.props = this.props;
        return {...data} as IBezierLayer;
    }
}
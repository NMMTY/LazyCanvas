import { BaseLayer } from "./BaseLayer";
import {
    FontWeight,
    LineCap,
    LineJoin,
    TextAlign,
    LayerType,
    Centring
} from "../../types/enum";
import {
    ITextLayer,
    ITextLayerProps,
    ScaleType,
    ColorType,
    AnyWeight,
    AnyTextAlign,
    AnyTextBaseline,
    AnyTextDirection
} from "../../types";
import { LazyError, LazyLog, defaultArg } from "../../utils/LazyUtil";
import { Gradient } from "../helpers/Gradient";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseColor,
    parseFillStyle,
    parser,
    parseToNormal,
    transform
} from "../../utils/utils";
import { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import { Pattern } from "../helpers/Pattern";
import { LayersManager } from "../managers/LayersManager";

export class TextLayer extends BaseLayer<ITextLayerProps> {
    props: ITextLayerProps;

    constructor(props?: ITextLayerProps) {
        super(LayerType.Text, props || {} as ITextLayerProps);
        this.props = props ? props : {} as ITextLayerProps;
        this.props.align = TextAlign.Left;
        this.props.font = {
            family: 'Geist',
            size: 16,
            weight: FontWeight.Regular,
        };
        this.props.fillStyle = '#ffffff';
        this.props.filled = true;
        this.props.multiline = {
            enabled: false,
            spacing: 1.1,
        };
        this.props.size = {
            width: 'vw',
            height: 0,
        }
        this.props.centring = Centring.Center;
    }

    /**
     * @description Sets the text of the text layer.
     * @param text {string} - The `text` of the text layer.
     */
    setText(text: string) {
        this.props.text = text;
        return this;
    }

    /**
     * @description Set the font of the text layer. You can use `Geist` and `GeistMono`, or you can upload your own font from file/base64 buffer.
     * @param familyOrConfig {string | { font: string; size: number; weight: AnyWeight }} - The `family` of the font. If you want to use FontsList, you can use the object config.
     * @param size {number} - The `size` of the font.
     * @param weight {AnyWeight} - The `weight` of the font.
     */
    setFont(familyOrConfig: string | { family: string; size: number; weight: AnyWeight }, size?: number, weight?: AnyWeight) {
        if (typeof familyOrConfig === "string") {
            if (!size) throw new LazyError('The size of the font must be provided');
            if (!weight) throw new LazyError('The weight of the font must be provided');
            this.props.font = {
                family: familyOrConfig,
                size,
                weight,
            };
        } else {
            this.props.font = {
                family: familyOrConfig.family,
                size: familyOrConfig.size,
                weight: familyOrConfig.weight,
            };
        }
        return this;
    }

    /**
     * @description Set the multiline of the text layer. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param enabled {boolean} - Whether the text is multiline.
     * @param width {ScaleType} - width of "window" the multiline text. Can be used in one line text for text max width.
     * @param height {ScaleType} - height of "window" the multiline text.
     * @param spacing {number} - The space between the lines.
     */
    setMultiline(enabled: boolean, width: ScaleType, height: ScaleType, spacing?: number) {
        this.props.multiline = {
            enabled: enabled,
            spacing: spacing || 1.1,
        };
        this.props.size = {
            width,
            height,
        }
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
     * @description Set the align of the text layer.
     * @param align {AnyTextAlign} - The `align` of the text layer.
     */
    setAlign(align: AnyTextAlign) {
        this.props.align = align;
        return this;
    }

    /**
     * @description Set the baseline of the text layer.
     * @param baseline {AnyTextBaseline} - The `baseline` of the text layer.
     */
    setBaseline(baseline: AnyTextBaseline) {
        this.props.baseline = baseline;
        return this;
    }

    /**
     * @description Set the direction of the text layer.
     * @param direction {AnyTextDirection} - The `direction` of the text layer.
     */
    setDirection(direction: AnyTextDirection) {
        this.props.direction = direction;
        return this;
    }

    /**
     * @description Set the stroke of the layer.
     * @param width {number} - The `width` of the stroke.
     * @param cap {string} - The `cap` of the stroke.
     * @param join {string} - The `join` of the stroke.
     * @param dash {number[]} - The `dash` of the stroke.
     * @param dashOffset {number} - The `dashOffset` of the stroke.
     * @param miterLimit {number} - The `miterLimit` of the stroke.
     */
    setStroke(width: number, cap?: LineCap, join?: LineJoin, dash?: number[], dashOffset?: number, miterLimit?: number) {
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

    measureText(ctx: SKRSContext2D, canvas: Canvas): { width: number, height: number } {
        const w = parseToNormal(this.props.size?.width, ctx, canvas);
        const h = parseToNormal(this.props.size?.height, ctx, canvas, { width: w, height: 0 }, { vertical: true });

        if (this.props.multiline.enabled) {
            return { width: w, height: h };
        } else {
            ctx.font = `${this.props.font.weight} ${this.props.font.size}px ${this.props.font.family}`;
            let data = ctx.measureText(this.props.text);
            return { width: data.width, height: this.props.font.size };
        }
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { x, y, w, h } = parcer.parseBatch({
            x: { v: this.props.x },
            y: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size?.width },
            h: { v: this.props.size?.height, options: defaultArg.vl(true) },
        })

        if (debug) LazyLog.log('none', `TextLayer:`, { x, y, w, h });

        ctx.save();
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type }, { text: this.props.text, textAlign: this.props.align, fontSize: this.props.font.size, multiline: this.props.multiline.enabled });
        ctx.beginPath();
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);
        ctx.textAlign = this.props.align;
        if (this.props.baseline) ctx.textBaseline = this.props.baseline;
        if (this.props.direction) ctx.direction = this.props.direction;
        if (this.props.multiline.enabled) {
            const words = this.props.text.split(' ');

            let lines = [];

            for (let fontSize = 1; fontSize <= this.props.font.size; fontSize++) {
                let lineHeight = fontSize * (this.props.multiline.spacing  || 1.1);

                ctx.font = `${this.props.font.weight} ${fontSize}px ${this.props.font.family}`;

                let xm = x
                let ym = y
                lines = [];
                let line = '';

                for (let word of words) {
                    let linePlus = line + word + ' ';
                    if (ctx.measureText(linePlus).width > w) {
                        lines.push({ text: line, x: xm, y: ym });
                        line = word + ' ';
                        ym += lineHeight;
                    } else {
                        line = linePlus;
                    }
                }
                lines.push({ text: line, x: xm, y: ym });
                if (ym > ym + h) break;

            }
            for (let line of lines) {
                this.drawText(this.props, ctx, await parseFillStyle(ctx, this.props.fillStyle), line.text, line.x, line.y, w, h);
            }
        } else {
            ctx.font = `${this.props.font.weight} ${this.props.font.size}px ${this.props.font.family}`;
            this.drawText(this.props, ctx, await parseFillStyle(ctx, this.props.fillStyle), this.props.text, x, y, w, h);
        }
        ctx.closePath();
        ctx.restore();
    }

    private drawText(props: ITextLayerProps, ctx: SKRSContext2D, fillStyle: string | CanvasGradient | CanvasPattern, text: string, x: number, y: number, w: number, h: number) {
        if (props.filled) {
            ctx.fillStyle = fillStyle;
            ctx.fillText(text, x, y, w);
        } else {
            ctx.strokeStyle = fillStyle;
            ctx.lineWidth = props.stroke?.width || 1;
            ctx.lineCap = props.stroke?.cap || 'butt';
            ctx.lineJoin = props.stroke?.join || 'miter';
            ctx.miterLimit = props.stroke?.miterLimit || 10;
            ctx.lineDashOffset = props.stroke?.dashOffset || 0;
            ctx.setLineDash(props.stroke?.dash || []);
            ctx.strokeText(text, x, y, w);
        }
    }

    /**
     * @returns {ITextLayer}
     */
    toJSON(): ITextLayer {
        let data = super.toJSON();
        data.props = this.props;
        return { ...data } as ITextLayer;
    }

}

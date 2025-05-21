import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import {
    ScaleType,
    ColorType,
    AnyWeight,
    AnyTextAlign,
    AnyTextBaseline,
    AnyTextDirection,
    FontWeight,
    LineCap,
    LineJoin,
    TextAlign,
    LayerType,
    Centring
} from "../../types";
import { LazyError, LazyLog, defaultArg } from "../../utils/LazyUtil";
import {
    drawShadow,
    filters,
    isColor,
    opacity,
    parseFillStyle,
    parser,
    parseToNormal,
    transform
} from "../../utils/utils";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LayersManager } from "../managers/LayersManager";

/**
 * Interface representing a Text Layer.
 */
export interface ITextLayer extends IBaseLayer {
    /**
     * The type of the layer, which is `Text`.
     */
    type: LayerType.Text;

    /**
     * The properties specific to the Text Layer.
     */
    props: ITextLayerProps;
}

/**
 * Interface representing the properties of a Text Layer.
 */
export interface ITextLayerProps extends IBaseLayerProps {
    /**
     * The text content of the layer.
     */
    text: string;

    /**
     * The font configuration for the text.
     */
    font: {
        /**
         * The font family.
         */
        family: string;

        /**
         * The font size.
         */
        size: number;

        /**
         * The font weight.
         */
        weight: AnyWeight;
    };

    /**
     * Configuration for multiline text.
     */
    multiline: {
        /**
         * Whether multiline is enabled.
         */
        enabled: boolean;

        /**
         * The spacing between lines (optional).
         */
        spacing?: number;
    };

    /**
     * The size of the text layer, including width and height.
     */
    size: {
        /**
         * The width of the text layer.
         */
        width: ScaleType;

        /**
         * The height of the text layer.
         */
        height: ScaleType;
    };

    /**
     * The alignment of the text.
     */
    align: AnyTextAlign;

    /**
     * The baseline of the text.
     */
    baseline: AnyTextBaseline;

    /**
     * The direction of the text.
     */
    direction: AnyTextDirection;

    /**
     * The spacing between letters.
     */
    letterSpacing: number;

    /**
     * The spacing between words.
     */
    wordSpacing: number;

    /**
     * The stroke properties of the text.
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
 * Class representing a Text Layer, extending the BaseLayer class.
 */
export class TextLayer extends BaseLayer<ITextLayerProps> {
    /**
     * The properties of the Text Layer.
     */
    props: ITextLayerProps;

    /**
     * Constructs a new TextLayer instance.
     * @param props {ITextLayerProps} - The properties of the Text Layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: ITextLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Text, props || {} as ITextLayerProps, misc);
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
        this.props.wordSpacing = 0;
        this.props.letterSpacing = 0;
    }

    /**
     * Sets the text of the text layer.
     * @param text {string} - The text content of the layer.
     * @returns {this} The current instance for chaining.
     */
    setText(text: string): this {
        this.props.text = text;
        return this;
    }

    /**
     * Sets the font of the text layer.
     * @param familyOrConfig {string | { family: string; size: number; weight: AnyWeight }} - The font family or configuration object.
     * @param size {number} - The font size (required if `familyOrConfig` is a string).
     * @param weight {AnyWeight} - The font weight (required if `familyOrConfig` is a string).
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If size or weight is not provided when `familyOrConfig` is a string.
     */
    setFont(familyOrConfig: string | { family: string; size: number; weight: AnyWeight }, size?: number, weight?: AnyWeight): this {
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
     * Configures the multiline properties of the text layer.
     * @param enabled {boolean} - Whether multiline is enabled.
     * @param width {ScaleType} - The width of the multiline text area.
     * @param height {ScaleType} - The height of the multiline text area.
     * @param spacing {number} - The spacing between lines (optional).
     * @returns {this} The current instance for chaining.
     */
    setMultiline(enabled: boolean, width: ScaleType, height: ScaleType, spacing?: number): this {
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
     * Sets the color of the text layer.
     * @param color {ColorType} - The color of the text.
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
     * Sets the alignment of the text layer.
     * @param align {AnyTextAlign} - The alignment of the text.
     * @returns {this} The current instance for chaining.
     */
    setAlign(align: AnyTextAlign): this {
        this.props.align = align;
        return this;
    }

    /**
     * Sets the baseline of the text layer.
     * @param baseline {AnyTextBaseline} - The baseline of the text.
     * @returns {this} The current instance for chaining.
     */
    setBaseline(baseline: AnyTextBaseline): this {
        this.props.baseline = baseline;
        return this;
    }

    /**
     * Sets the direction of the text layer.
     * @param direction {AnyTextDirection} - The direction of the text.
     * @returns {this} The current instance for chaining.
     */
    setDirection(direction: AnyTextDirection): this {
        this.props.direction = direction;
        return this;
    }

    /**
     * Configures the stroke properties of the text layer.
     * @param width {number} - The width of the stroke.
     * @param cap {string} - The cap style of the stroke (optional).
     * @param join {string} - The join style of the stroke (optional).
     * @param dash {number[]} - The dash pattern of the stroke (optional).
     * @param dashOffset {number} - The dash offset of the stroke (optional).
     * @param miterLimit {number} - The miter limit of the stroke (optional).
     * @returns {this} The current instance for chaining.
     */
    setStroke(width: number, cap?: LineCap, join?: LineJoin, dash?: number[], dashOffset?: number, miterLimit?: number): this {
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
     * Sets whether the text layer should be filled or stroked.
     * @param filled {boolean} - If true, the layer will be filled; otherwise, it will be stroked.
     * @returns {this} The current instance for chaining.
     */
    setFilled(filled: boolean): this {
        this.props.filled = filled;
        return this;
    }

    /**
     * Sets the spacing between words in the text layer.
     * @param wordSpacing {number} - The spacing between words.
     * @returns {this} The current instance for chaining.
     */
    setWordSpacing(wordSpacing: number): this {
        this.props.wordSpacing = wordSpacing;
        return this;
    }

    /**
     * Sets the spacing between letters in the text layer.
     * @param letterSpacing {number} - The spacing between letters.
     * @returns {this} The current instance for chaining.
     */
    setLetterSpacing(letterSpacing: number): this {
        this.props.letterSpacing = letterSpacing;
        return this;
    }

    /**
     * Measures the dimensions of the text.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @returns {Object} The width and height of the text.
     */
    measureText(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas): { width: number, height: number } {
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

    /**
     * Draws the text layer on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void>  {
        const parcer = parser(ctx, canvas, manager);

        const { x, y, w } = parcer.parseBatch({
            x: { v: this.props.x },
            y: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size?.width },
        })

        const h = parcer.parse(this.props.size?.height, defaultArg.wh(w), defaultArg.vl(true));

        if (debug) LazyLog.log('none', `TextLayer:`, { x, y, w, h });

        ctx.save();
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type }, { text: this.props.text, textAlign: this.props.align, fontSize: this.props.font.size, multiline: this.props.multiline.enabled });
        ctx.beginPath();
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);
        ctx.textAlign = this.props.align;
        ctx.letterSpacing = `${this.props.letterSpacing}px`;
        ctx.wordSpacing = `${this.props.wordSpacing}px`;
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
                this.drawText(this.props, ctx, await parseFillStyle(ctx, this.props.fillStyle), line.text, line.x, line.y, w);
            }
        } else {
            ctx.font = `${this.props.font.weight} ${this.props.font.size}px ${this.props.font.family}`;
            this.drawText(this.props, ctx, await parseFillStyle(ctx, this.props.fillStyle), this.props.text, x, y, w);
        }
        ctx.closePath();
        ctx.restore();
    }

    /**
     * Draws the text on the canvas.
     * @param props {ITextLayerProps} - The properties of the text layer.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param fillStyle {string | CanvasGradient | CanvasPattern} - The fill style for the text.
     * @param text {string} - The text content.
     * @param x {number} - The x-coordinate of the text.
     * @param y {number} - The y-coordinate of the text.
     * @param w {number} - The width of the text area.
     */
    private drawText(props: ITextLayerProps, ctx: SKRSContext2D, fillStyle: string | CanvasGradient | CanvasPattern, text: string, x: number, y: number, w: number) {
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
     * Converts the Text Layer to a JSON representation.
     * @returns {ITextLayer} The JSON representation of the Text Layer.
     */
    public toJSON(): ITextLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as ITextLayer;
    }
}

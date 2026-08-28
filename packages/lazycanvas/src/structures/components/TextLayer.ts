import { type Signal, unwrap } from "../../core";
import {
  type AnyTextAlign,
  type AnyTextBaseline,
  type AnyTextDirection,
  type AnyWeight,
  type ColorType,
  FontWeight,
  type ICanvas,
  type ICanvasRenderingContext2D,
  LayerType,
  type LineCap,
  type LineJoin,
  type ScaleType,
  type StrokeOptions,
  type SubStringColor,
  TextAlign,
} from "../../types";
import {
  DrawUtils,
  LazyError,
  LazyLog,
  cssFont,
  defaultArg,
  isColor,
  parseFillStyle,
  parseToNormal,
  parser,
  transform,
} from "../../utils";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerMisc, type IBaseLayerProps } from "./BaseLayer";

/**
 * Interface representing a Text layer.
 */
export interface ITextLayer extends IBaseLayer {
  /**
   * The type of the layer, which is `Text`.
   */
  type: LayerType.Text;

  /**
   * The properties specific to the Text layer.
   */
  props: ITextLayerProps;
}

/**
 * Interface representing the properties of a Text layer.
 */
export interface ITextLayerProps extends IBaseLayerProps {
  /**
   * The text content of the layer.
   */
  text: string | Signal<string>;

  /**
   * The fill style (color or pattern) of the layer.
   */
  color: ColorType;

  /**
   * Array of substring color configurations for partial text coloring.
   */
  subStringColors?: SubStringColor[];

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
  multiline?: {
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
   * The size of the Text layer, including width and height.
   */
  size?: {
    /**
     * The width of the Text layer.
     */
    width: ScaleType;

    /**
     * The height of the Text layer.
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
  baseline?: AnyTextBaseline;

  /**
   * The direction of the text.
   */
  direction?: AnyTextDirection;

  /**
   * The spacing between letters.
   */
  letterSpacing?: number;

  /**
   * The spacing between words.
   */
  wordSpacing?: number;

  /**
   * The stroke properties of the text.
   */
  stroke?: StrokeOptions;
}

/**
 * Class representing a Text layer, extending the BaseLayer class.
 */
export class TextLayer extends BaseLayer<ITextLayerProps> {
  /**
   * The properties of the Text Layer.
   */
  props: ITextLayerProps;

  /**
   * Constructs a new TextLayer instance.
   * @param {ITextLayerProps} [props] - The properties of the Text layer.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   */
  constructor(props?: ITextLayerProps, misc?: IBaseLayerMisc) {
    super(LayerType.Text, props || ({} as ITextLayerProps), misc);
    this.props = props ? props : ({} as ITextLayerProps);
    this.props = this.validateProps(this.props);
  }

  /**
   * Sets the text of the text layer.
   * @param {string} [text] - The text content of the layer.
   * @returns {this} The current instance for chaining.
   */
  setText(text: string): this {
    this.props.text = text;
    return this;
  }

  /**
   * Sets the font of the text layer.
   * @param {string | { family: string; size: number; weight: AnyWeight }} [familyOrConfig] - The font family or configuration object.
   * @param {number} [size] - The font size (required if `familyOrConfig` is a string).
   * @param {AnyWeight} [weight] - The font weight (required if `familyOrConfig` is a string).
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If size or weight is not provided when `familyOrConfig` is a string.
   */
  setFont(
    familyOrConfig: string | { family: string; size: number; weight: AnyWeight },
    size?: number,
    weight?: AnyWeight,
  ): this {
    if (typeof familyOrConfig === "string") {
      if (!size) throw new LazyError("The size of the font must be provided");
      if (!weight) throw new LazyError("The weight of the font must be provided");
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
   * @param {ScaleType} [width] - The width of the multiline text area.
   * @param {ScaleType} [height] - The height of the multiline text area.
   * @param {number} [spacing] - The spacing between lines (optional).
   * @returns {this} The current instance for chaining.
   */
  setMultiline(width: ScaleType, height: ScaleType, spacing?: number): this {
    this.props.multiline = {
      enabled: true,
      spacing: spacing || 1.1,
    };
    this.props.size = {
      width,
      height,
    };
    return this;
  }

  /**
   * Sets the color of the text layer.
   * @param {ColorType} [color] - The base color of the text.
   * @param {SubStringColor[]} [sub] - Optional substring colors for partial text coloring.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the color is not provided or invalid.
   */
  setColor(color: ColorType, ...sub: SubStringColor[]): this {
    if (!color) throw new LazyError("The color of the layer must be provided");
    if (!isColor(color)) throw new LazyError("The color of the layer must be a valid color");
    this.props.color = color;
    if (sub && sub.length > 0) {
      this.props.subStringColors = sub;
    }
    return this;
  }

  /**
   * Sets the alignment of the text layer.
   * @param {AnyTextAlign} [align] - The alignment of the text.
   * @returns {this} The current instance for chaining.
   */
  setAlign(align: AnyTextAlign): this {
    this.props.align = align;
    return this;
  }

  /**
   * Sets the baseline of the text layer.
   * @param {AnyTextBaseline} [baseline] - The baseline of the text.
   * @returns {this} The current instance for chaining.
   */
  setBaseline(baseline: AnyTextBaseline): this {
    this.props.baseline = baseline;
    return this;
  }

  /**
   * Sets the direction of the text layer.
   * @param {AnyTextDirection} [direction] - The direction of the text.
   * @returns {this} The current instance for chaining.
   */
  setDirection(direction: AnyTextDirection): this {
    this.props.direction = direction;
    return this;
  }

  /**
   * Configures the stroke properties of the text layer.
   * @param {number} [width] - The width of the stroke.
   * @param {string} [cap] - The cap style of the stroke.
   * @param {string} [join] - The join style of the stroke.
   * @param {number[]} [dash] - The dash pattern of the stroke.
   * @param {number} [dashOffset] - The dash offset of the stroke.
   * @param {number} [miterLimit] - The miter limit of the stroke.
   * @returns {this} The current instance for chaining.
   */
  setStroke(
    width: number,
    cap?: LineCap,
    join?: LineJoin,
    dash?: number[],
    dashOffset?: number,
    miterLimit?: number,
  ): this {
    this.props.stroke = {
      width,
      cap: cap || "butt",
      join: join || "miter",
      dash: dash || [],
      dashOffset: dashOffset || 0,
      miterLimit: miterLimit || 10,
    };
    return this;
  }

  /**
   * Sets the spacing between words in the text layer.
   * @param {number} [wordSpacing] - The spacing between words.
   * @returns {this} The current instance for chaining.
   */
  setWordSpacing(wordSpacing: number): this {
    this.props.wordSpacing = wordSpacing;
    return this;
  }

  /**
   * Sets the spacing between letters in the text layer.
   * @param {number} [letterSpacing] - The spacing between letters.
   * @returns {this} The current instance for chaining.
   */
  setLetterSpacing(letterSpacing: number): this {
    this.props.letterSpacing = letterSpacing;
    return this;
  }

  /**
   * Measures the dimensions of the text.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
   * @returns {Object} The width and height of the text.
   */
  measureText(ctx: ICanvasRenderingContext2D, canvas: ICanvas): { width: number; height: number } {
    ctx.font = cssFont(this.props.font);

    if (this.props?.multiline?.enabled) {
      const w = parseToNormal(this.props.size?.width || "vw", ctx, canvas);

      // Calculate actual height based on text wrapping
      const words = unwrap(this.props.text).split(" ");
      let line = "";
      let linesCount = 1;

      for (const word of words) {
        const linePlus = `${line + word} `;
        if (ctx.measureText(linePlus).width > w) {
          linesCount++;
          line = `${word} `;
        } else {
          line = linePlus;
        }
      }

      const lineHeight = this.props.font.size * (this.props.multiline.spacing || 1.1);
      const calculatedHeight = linesCount * lineHeight;

      // If height is fixed in props, use it, otherwise use calculated height
      const fixedHeight = this.props.size?.height
        ? parseToNormal(
            this.props.size.height,
            ctx,
            canvas,
            { width: w, height: 0 },
            { vertical: true },
          )
        : 0;

      return { width: w, height: fixedHeight || calculatedHeight };
    }
    const data = ctx.measureText(unwrap(this.props.text));
    return { width: data.width, height: this.props.font.size };
  }

  /**
   * Draws the text layer on the canvas.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   */
  async draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
  ): Promise<void> {
    const parcer = parser(ctx, canvas, manager);

    const { x, y, w } = parcer.parseBatch({
      x: { v: this.props.position?.x || 0 },
      y: { v: this.props.position?.y || 0, options: defaultArg.vl(true) },
      w: { v: this.props.size?.width || "vw" },
    });

    const h = parcer.parse(this.props.size?.height || 0, defaultArg.wh(w), defaultArg.vl(true));

    if (debug) LazyLog.log("none", "TextLayer:", { x, y, w, h });

    ctx.save();
    if (this.props.transform) {
      transform(
        ctx,
        this.props.transform,
        { width: w, height: h, x, y, type: this.type },
        {
          text: unwrap(this.props.text),
          textAlign: this.props.align,
          fontSize: this.props.font.size,
          multiline: this.props?.multiline?.enabled || false,
        },
      );
    }
    ctx.beginPath();
    DrawUtils.drawShadow(ctx, this.props.shadow);
    DrawUtils.opacity(ctx, this.props.opacity);
    DrawUtils.filters(ctx, this.props.filter);

    // When layout is managed by Yoga, always use top-left alignment
    // since Yoga calculates position as top-left corner
    const useLayoutAlignment = (this.props as any)._computedLayout === true;

    ctx.textAlign = useLayoutAlignment ? "left" : this.props.align;
    if (this.props.letterSpacing) ctx.letterSpacing = `${this.props.letterSpacing}px`;
    if (this.props.wordSpacing) ctx.wordSpacing = `${this.props.wordSpacing}px`;
    ctx.textBaseline = useLayoutAlignment ? "top" : this.props.baseline || "alphabetic";
    if (this.props.direction) ctx.direction = this.props.direction;

    const fillStyle = await parseFillStyle(ctx, this.props.color, {
      debug,
      layer: { width: w, height: h, x, y, align: "center" },
      manager,
    });
    if (this.props?.multiline?.enabled) {
      const words = unwrap(this.props.text).split(" ");

      let lines: Array<{ text: string; x: number; y: number; startOffset: number }> = [];

      for (let fontSize = 1; fontSize <= this.props.font.size; fontSize++) {
        const lineHeight = fontSize * (this.props.multiline.spacing || 1.1);

        ctx.font = cssFont(this.props.font, fontSize);

        const xm = x;
        let ym = y;
        lines = [];
        let line = "";
        let charOffset = 0; // Track position in original text

        for (const word of words) {
          const linePlus = `${line + word} `;
          if (ctx.measureText(linePlus).width > w) {
            lines.push({ text: line, x: xm, y: ym, startOffset: charOffset });
            charOffset += line.length;
            line = `${word} `;
            ym += lineHeight;
          } else {
            line = linePlus;
          }
        }
        lines.push({ text: line, x: xm, y: ym, startOffset: charOffset });
        if (ym > ym + h) break;
      }
      for (const line of lines) {
        this.drawText(this.props, ctx, fillStyle, line.text, line.x, line.y, w, line.startOffset);
      }
    } else {
      ctx.font = cssFont(this.props.font);
      this.drawText(this.props, ctx, fillStyle, unwrap(this.props.text), x, y, w, 0);
    }
    ctx.closePath();
    ctx.restore();
  }

  /**
   * Draws the text on the canvas.
   * @param {ITextLayerProps} [props] - The properties of the text layer.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {string | CanvasGradient | CanvasPattern}  [fillStyle] - The fill style for the text.
   * @param {string} [text] - The text content.
   * @param {number} [x] - The x-coordinate of the text.
   * @param {number} [y] - The y-coordinate of the text.
   * @param {number} [w] - The width of the text area.
   * @param {number} [textOffset] - The offset of this text segment in the original full text (for multiline support).
   */
  private drawText(
    props: ITextLayerProps,
    ctx: ICanvasRenderingContext2D,
    fillStyle: string | CanvasGradient | CanvasPattern,
    text: string,
    x: number,
    y: number,
    w: number,
    textOffset = 0,
  ) {
    // If no substring colors are defined, draw normally
    if (!props.subStringColors || props.subStringColors.length === 0) {
      DrawUtils.fillStyle(ctx, fillStyle, this.props.stroke);
      if (props.stroke) {
        ctx.strokeText(text, x, y, w);
      } else {
        ctx.fillText(text, x, y, w);
      }
      return;
    }

    // Draw text with substring colors
    const textLength = text.length;
    let currentX = x;

    // Save original text alignment and set to left for manual positioning
    const originalAlign = ctx.textAlign;
    ctx.textAlign = "left";

    // Adjust starting X based on text alignment
    const alignValue = props.align as string;
    if (alignValue === TextAlign.Center || alignValue === "center") {
      const totalWidth = ctx.measureText(text).width;
      currentX = x - totalWidth / 2;
    } else if (
      alignValue === TextAlign.Right ||
      alignValue === "right" ||
      alignValue === TextAlign.End ||
      alignValue === "end"
    ) {
      const totalWidth = ctx.measureText(text).width;
      currentX = x - totalWidth;
    }

    // Create segments based on substring colors
    const segments: Array<{ text: string; color: string; start: number; end: number }> = [];

    // Sort substring colors by start position
    const sortedColors = [...props.subStringColors].sort((a, b) => a.start - b.start);

    let currentIndex = 0;

    for (const subColor of sortedColors) {
      // Adjust positions based on textOffset (for multiline support)
      const globalStart = subColor.start;
      const globalEnd = subColor.end;
      const lineStart = textOffset;
      const lineEnd = textOffset + textLength;

      // Skip if this color segment doesn't overlap with current line
      if (globalEnd <= lineStart || globalStart >= lineEnd) {
        continue;
      }

      // Calculate local positions within this line
      const localStart = Math.max(0, globalStart - lineStart);
      const localEnd = Math.min(textLength, globalEnd - lineStart);

      // Add base color segment before this substring color
      if (currentIndex < localStart) {
        segments.push({
          text: text.substring(currentIndex, localStart),
          color: fillStyle as string,
          start: currentIndex,
          end: localStart,
        });
      }

      // Add colored substring
      if (localStart < localEnd) {
        segments.push({
          text: text.substring(localStart, localEnd),
          color: parseFillStyle(ctx, subColor.color, {
            debug: false,
            layer: { width: w, height: 0, x: 0, y: 0, align: "center" },
          }) as string,
          start: localStart,
          end: localEnd,
        });
        currentIndex = localEnd;
      }
    }

    // Add remaining text with base color
    if (currentIndex < textLength) {
      segments.push({
        text: text.substring(currentIndex),
        color: fillStyle as string,
        start: currentIndex,
        end: textLength,
      });
    }

    // Draw each segment
    for (const segment of segments) {
      if (segment.text.length === 0) continue;

      const segmentWidth = ctx.measureText(segment.text).width;
      DrawUtils.fillStyle(ctx, segment.color, this.props.stroke);

      if (props.stroke) {
        ctx.strokeText(segment.text, currentX, y);
      } else {
        ctx.fillText(segment.text, currentX, y);
      }

      currentX += segmentWidth;
    }

    // Restore original text alignment
    ctx.textAlign = originalAlign;
  }

  /**
   * Converts the Text layer to a JSON representation.
   * @returns {ITextLayer} The JSON representation of the Text layer.
   */
  public toJSON(): ITextLayer {
    const data = super.toJSON();
    const copy: any = { ...data.props };

    for (const key of ["x", "y", "size.width", "size.height", "fillStyle"]) {
      if (copy[key] && typeof copy[key] === "object" && "toJSON" in copy[key]) {
        copy[key] = copy[key].toJSON();
      }
    }

    return { ...data, props: copy } as ITextLayer;
  }

  /**
   * Validates the properties of the Text layer.
   * @param {ITextLayerProps} [data] - The properties to validate.
   * @returns {ITextLayerProps} The validated properties.
   */
  protected validateProps(data: ITextLayerProps): ITextLayerProps {
    return {
      ...super.validateProps(data),
      color: data.color || "#000000",
      text: data.text || "",
      font: {
        family: data.font?.family || "Arial",
        size: data.font?.size || 16,
        weight: data.font?.weight || FontWeight.Regular,
      },
      multiline: {
        enabled: data.multiline?.enabled || false,
        spacing: data.multiline?.spacing || 1.1,
      },
      size: {
        width: data.size?.width || 0,
        height: data.size?.height || 0,
      },
      align: data.align || TextAlign.Left,
    };
  }
}

import {
  type AnyCentring,
  type ColorType,
  type ICanvas,
  type ICanvasRenderingContext2D,
  LayerType,
  type RadiusCorner,
  type ScaleType,
  type StrokeOptions,
} from "../../types";
import {
  DrawUtils,
  LazyError,
  LazyLog,
  centring,
  defaultArg,
  isColor,
  parseFillStyle,
  parser,
} from "../../utils";
import { Link } from "../helpers";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerMisc, type IBaseLayerProps } from "./BaseLayer";

/**
 * Interface representing a Morph Layer.
 */
export interface IMorph extends IBaseLayer {
  /**
   * The type of the layer, which is `Morph`.
   */
  type: LayerType.Morph;

  /**
   * The properties specific to the Morph Layer.
   */
  props: IMorphProps;
}

/**
 * Interface representing the properties of a Morph Layer.
 */
export interface IMorphProps extends IBaseLayerProps {
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
    radius?: { [corner in RadiusCorner]?: ScaleType };
  };

  /**
   * The fill style (color or pattern) of the layer.
   */
  color: ColorType;

  /**
   * The stroke properties of the morph.
   */
  stroke?: StrokeOptions;
}

/**
 * Class representing a Morph Layer, extending the BaseLayer class.
 */
export class Morph extends BaseLayer<IMorphProps> {
  /**
   * The properties of the Morph Layer.
   */
  props: IMorphProps;

  /**
   * Constructs a new Morph instance.
   * @param {IMorphProps} [props] - The properties of the Morph Layer.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   */
  constructor(props?: IMorphProps, misc?: IBaseLayerMisc) {
    super(LayerType.Morph, props || ({} as IMorphProps), misc);
    this.props = props ? props : ({} as IMorphProps);
    this.props = this.validateProps(this.props);
  }

  /**
   * Sets the size of the Morph Layer.
   * @param {ScaleType} [width] - The width of the Morph Layer.
   * @param {ScaleType} [height] - The height of the Morph Layer.
   * @param {{ [corner in radiusCorner]?: ScaleType }} [radius] - The radius of the Morph Layer (optional).
   * @returns {this} The current instance for chaining.
   */
  setSize(
    width: ScaleType,
    height: ScaleType,
    radius?: { [corner in RadiusCorner]?: ScaleType },
  ): this {
    this.props.size = {
      width: width,
      height: height,
      radius: radius || { all: 0 },
    };
    return this;
  }

  /**
   * Sets the color of the Morph Layer.
   * @param {ColorType} [color] - The color of the layer.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the color is not provided or invalid.
   */
  setColor(color: ColorType): this {
    if (!color) throw new LazyError("The color of the layer must be provided");
    if (!isColor(color)) throw new LazyError("The color of the layer must be a valid color");
    this.props.color = color;
    return this;
  }

  /**
   * Sets the stroke properties of the Morph Layer.
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
    cap?: CanvasLineCap,
    join?: CanvasLineJoin,
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
   * Draws the Morph Layer on the canvas.
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

    const { xs, ys, w } = parcer.parseBatch({
      xs: { v: this.props.position?.x || 0 },
      ys: { v: this.props.position?.y || 0, options: defaultArg.vl(true) },
      w: { v: this.props.size.width },
    });

    const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

    const rad: { [corner in RadiusCorner]?: number } = {};
    if (typeof this.props.size.radius === "object" && this.props.size.radius !== Link) {
      for (const corner in this.props.size.radius) {
        // @ts-ignore
        rad[corner] = parcer.parse(
          // @ts-ignore
          this.props.size.radius[corner],
          defaultArg.wh(w / 2, h / 2),
          defaultArg.vl(false, true),
        );
      }
    }

    const { x, y } = centring(this.props.centring as AnyCentring, this.type, w, h, xs, ys);
    const fillStyle = await parseFillStyle(ctx, this.props.color, {
      debug,
      layer: { width: w, height: h, x: xs, y: ys, align: this.props.centring as AnyCentring },
      manager,
    });

    if (debug) LazyLog.log("none", "Morph:", { x, y, w, h, rad });

    ctx.save();
    try {
      this.applyTransform(ctx, { x, y, width: w, height: h });
      ctx.beginPath();
      if (Object.keys(rad).length > 0) {
        DrawUtils.roundedRect(ctx, x, y, w, h, rad);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.closePath();

      DrawUtils.drawShadow(ctx, this.props.shadow);
      DrawUtils.opacity(ctx, this.props.opacity);
      DrawUtils.filters(ctx, this.props.filter);
      DrawUtils.fillStyle(ctx, fillStyle, this.props.stroke);

      if (this.props.stroke) {
        ctx.stroke();
      } else {
        ctx.fill();
      }
    } finally {
      ctx.restore();
    }
  }

  /**
   * Converts the Morph Layer to a JSON representation.
   * @returns {IMorph} The JSON representation of the Morph Layer.
   */
  toJSON(): IMorph {
    const data = super.toJSON();
    const copy: any = { ...data.props };

    for (const key of ["x", "y", "size.width", "size.height", "size.radius", "fillStyle"]) {
      if (copy[key] && typeof copy[key] === "object" && "toJSON" in copy[key]) {
        copy[key] = copy[key].toJSON();
      }
    }

    return { ...data, props: copy } as IMorph;
  }

  /**
   * Validates the properties of the Morph Layer.
   * @param {IMorphProps} [data] - The properties to validate.
   * @returns {IMorphProps} The validated properties.
   */
  protected validateProps(data: IMorphProps): IMorphProps {
    return {
      ...super.validateProps(data),
      color: data.color || "#000000",
      size: {
        width: data.size?.width || 100,
        height: data.size?.height || 100,
        radius: data.size?.radius || { all: 0 },
      },
    };
  }
}

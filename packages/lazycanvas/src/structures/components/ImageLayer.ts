import {
  type AnyCentring,
  type ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  LayerType,
  type RadiusCorner,
  type ScaleType,
} from "../../types";
import {
  DrawUtils,
  LazyError,
  LazyLog,
  centring,
  defaultArg,
  isImageUrlValid,
  loadImageFallback,
  parser,
  transform,
} from "../../utils";
import { Link } from "../helpers";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerMisc, type IBaseLayerProps } from "./BaseLayer";

/** A short description of an image source for log messages. */
function describeSource(src: unknown): string {
  if (typeof src !== "string") return "binary image data";
  return src.length > 80 ? `"${src.slice(0, 77)}…"` : `"${src}"`;
}

/**
 * Interface representing an Image Layer.
 */
export interface IImageLayer extends IBaseLayer {
  /**
   * The type of the layer, which is `Image`.
   */
  type: LayerType.Image;

  /**
   * The properties specific to the Image Layer.
   */
  props: IImageLayerProps;
}

/**
 * Interface representing the properties of an Image Layer.
 */
export interface IImageLayerProps extends IBaseLayerProps {
  /**
   * The source of the image, which can be a URL or a Buffer.
   */
  src: string | Buffer;

  /**
   * What to draw when the image cannot be loaded: a neutral box with a cross, in
   * the layer's size and with its rounded corners, so the layout keeps its shape
   * and the other layers still render. Pass `false` to make the failure an error
   * instead.
   */
  placeholder?: false | { color?: string; stroke?: string };

  /**
   * The size of the image, including width, height, and radius.
   */
  size: {
    /**
     * The width of the image.
     */
    width: ScaleType;

    /**
     * The height of the image.
     */
    height: ScaleType;

    /**
     * The radius of the image.
     */
    radius?: { [corner in RadiusCorner]?: ScaleType };
  };
}

/**
 * Class representing an Image Layer, extending the BaseLayer class.
 */
export class ImageLayer extends BaseLayer<IImageLayerProps> {
  /**
   * The properties of the Image Layer.
   */
  props: IImageLayerProps;

  /**
   * Constructs a new ImageLayer instance.
   * @param {IImageLayerProps} [props] - The properties of the Image Layer.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   */
  constructor(props?: IImageLayerProps, misc?: IBaseLayerMisc) {
    super(LayerType.Image, props || ({} as IImageLayerProps), misc);
    this.props = props ? props : ({} as IImageLayerProps);
    this.props = this.validateProps(this.props);
  }

  /**
   * Sets the source of the image.
   * @param {string} [src] - The source of the image, which can be a URL or file path.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the source is not a valid URL.
   */
  setSrc(src: string): this {
    if (!isImageUrlValid(src)) throw new LazyError("The src of the image must be a valid URL");
    this.props.src = src;
    return this;
  }

  /**
   * Sets the placeholder drawn when the image cannot be loaded.
   * @param {false | { color?: string; stroke?: string }} [placeholder] - Colors of the box and
   * its cross, or `false` to throw instead of drawing a placeholder.
   * @returns {this} The current instance for chaining.
   */
  setPlaceholder(placeholder: false | { color?: string; stroke?: string }): this {
    this.props.placeholder = placeholder;
    return this;
  }

  /**
   * Sets the size of the image.
   * @param {ScaleType} [width] - The width of the image.
   * @param {ScaleType} [height] - The height of the image.
   * @param {{ [corner in radiusCorner]?: ScaleType }} [radius] - The radius of the image (optional).
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
   * Draws the Image Layer on the canvas.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @throws {LazyError} If the image could not be loaded.
   */
  async draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ): Promise<void> {
    const parcer = parser(ctx, canvas, manager);

    const { xs, ys, w } = parcer.parseBatch({
      xs: { v: this.props.position?.x || 0 },
      ys: { v: this.props.position?.y || 0, options: defaultArg.vl(true) },
      w: { v: this.props.size.width },
    });

    const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));
    const { x, y } = centring(this.props.centring as AnyCentring, this.type, w, h, xs, ys);

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

    if (debug) LazyLog.log("none", "ImageLayer:", { x, y, w, h, rad });

    // Load before saving the context: holding a save() across a network fetch
    // leaves the state stack open for as long as the image takes to arrive.
    let image: any = null;
    let failure: unknown;
    try {
      image = adapter
        ? await adapter.loadImage(this.props.src)
        : await loadImageFallback(this.props.src);
    } catch (error) {
      failure = error;
    }

    if (!image) {
      const reason =
        failure instanceof Error ? failure.message : "the image loader returned nothing";
      if (this.props.placeholder === false) {
        throw new LazyError(`ImageLayer "${this.id}": the image could not be loaded (${reason})`);
      }
      LazyLog.log(
        "warn",
        `ImageLayer "${this.id}": could not load ${describeSource(this.props.src)} (${reason}); drawing a placeholder`,
      );
    }

    ctx.save();
    try {
      if (this.props.transform) {
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
      }
      DrawUtils.drawShadow(ctx, this.props.shadow);
      DrawUtils.opacity(ctx, this.props.opacity);
      DrawUtils.filters(ctx, this.props.filter);

      if (Object.keys(rad).length > 0) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.arcTo(x + w, y, x + w, y + h / 2, rad.rightTop || rad.all || 0);
        ctx.arcTo(x + w, y + h, x + w / 2, y + h, rad.rightBottom || rad.all || 0);
        ctx.arcTo(x, y + h, x, y + h / 2, rad.leftBottom || rad.all || 0);
        ctx.arcTo(x, y, x + w / 2, y, rad.leftTop || rad.all || 0);
        ctx.closePath();
        ctx.clip();
      }

      if (image) {
        ctx.drawImage(image, x, y, w, h);
      } else {
        this.drawPlaceholder(ctx, x, y, w, h);
      }
    } finally {
      ctx.restore();
    }
  }

  /**
   * Draws the stand-in for an image that could not be loaded: a filled box with
   * a cross, clipped by whatever clip the caller has set up.
   */
  private drawPlaceholder(
    ctx: ICanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const options = this.props.placeholder || {};
    ctx.fillStyle = options.color ?? "#e5e7eb";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = options.stroke ?? "#9ca3af";
    ctx.lineWidth = Math.max(1, Math.min(w, h) / 24);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }

  /**
   * Converts the Image Layer to a JSON representation.
   * @returns {IImageLayer} The JSON representation of the Image Layer.
   */
  toJSON(): IImageLayer {
    const data = super.toJSON();
    const copy: any = { ...data.props };

    for (const key of ["x", "y", "size.width", "size.height", "size.radius"]) {
      if (copy[key] && typeof copy[key] === "object" && "toJSON" in copy[key]) {
        copy[key] = copy[key].toJSON();
      }
    }

    return { ...data } as IImageLayer;
  }

  /**
   * Validates the properties of the Image Layer.
   * @param {IImageLayerProps} [data] - The properties to validate.
   * @returns {IImageLayerProps} The validated properties.
   */
  protected validateProps(data: IImageLayerProps): IImageLayerProps {
    return {
      ...super.validateProps(data),
      src: data.src || "",
      size: {
        width: data.size?.width || 0,
        height: data.size?.height || 0,
        radius: data.size?.radius || { all: 0 },
      },
    };
  }
}

import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import {ScaleType, Centring, LayerType, radiusCorner} from "../../types";
import { Canvas, loadImage, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
    centring,
    drawShadow,
    filters,
    isImageUrlValid,
    opacity,
    parser,
    transform
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { LayersManager } from "../managers/LayersManager";
import {Link} from "../helpers";

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
        radius: { [corner in radiusCorner]?: ScaleType };
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
     * @param props {IImageLayerProps} - The properties of the Image Layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: IImageLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Image, props || {} as IImageLayerProps, misc);
        this.props = props ? props : {} as IImageLayerProps;
        this.props.centring = Centring.Center;
    }

    /**
     * Sets the source of the image.
     * @param src {string} - The source of the image, which can be a URL or file path.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the source is not a valid URL.
     */
    setSrc(src: string): this {
        if (!isImageUrlValid(src)) throw new LazyError('The src of the image must be a valid URL');
        this.props.src = src;
        return this;
    }

    /**
     * Sets the size of the image.
     * @param width {ScaleType} - The width of the image.
     * @param height {ScaleType} - The height of the image.
     * @param radius {{ [corner in radiusCorner]?: ScaleType }} - The radius of the image (optional).
     * @returns {this} The current instance for chaining.
     */
    setSize(width: ScaleType, height: ScaleType, radius?: { [corner in radiusCorner]?: ScaleType }): this {
        this.props.size = {
            width: width,
            height: height,
            radius: radius || { all: 0 },
        };
        return this;
    }
    /**
     * Draws the Image Layer on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     * @throws {LazyError} If the image could not be loaded.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width }
        });

        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));
        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);

        const rad: { [corner in radiusCorner]?: number } = {};
        if (typeof this.props.size.radius === 'object' && this.props.size.radius !== Link) {
            for (const corner in this.props.size.radius) {
                // @ts-ignore
                rad[corner] = parcer.parse(this.props.size.radius[corner], defaultArg.wh(w / 2, h / 2), defaultArg.vl(false, true));
            }
        }

        if (debug) LazyLog.log('none', `ImageLayer:`, { x, y, w, h, rad });

        ctx.save();
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);
        let image = await loadImage(this.props.src);
        image.width = w;
        image.height = h;
        if (!image) throw new LazyError('The image could not be loaded');
        if (Object.keys(rad).length > 0) {
            ctx.beginPath();
            ctx.moveTo(x + (w / 2), y);
            ctx.arcTo(x + w, y, x + w, y + (h / 2), rad.rightTop || rad.all || 0);
            ctx.arcTo(x + w, y + h, x + (w / 2), y + h, rad.rightBottom || rad.all || 0);
            ctx.arcTo(x, y + h, x, y + (h / 2), rad.leftBottom || rad.all || 0);
            ctx.arcTo(x, y, x + (w / 2), y, rad.leftTop || rad.all || 0);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(image, x, y, w, h);
        } else {
            ctx.drawImage(image, x, y, w, h);
        }
        ctx.restore();
    }

    /**
     * Converts the Image Layer to a JSON representation.
     * @returns {IImageLayer} The JSON representation of the Image Layer.
     */
    toJSON(): IImageLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height', 'size.radius']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data } as IImageLayer;
    }
}
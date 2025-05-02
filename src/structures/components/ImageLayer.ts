import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ScaleType } from "../../types";
import { Centring, LayerType } from "../../types/enum";
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

export interface IImageLayer extends IBaseLayer {
    props: IImageLayerProps;
}

export interface IImageLayerProps extends IBaseLayerProps {
    src: string | Buffer;
    resize: boolean;
    size: {
        width: ScaleType;
        height: ScaleType;
        radius: ScaleType;
    }
}

export class ImageLayer extends BaseLayer<IImageLayerProps> {
    props: IImageLayerProps;

    constructor(props?: IImageLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Image, props || {} as IImageLayerProps, misc);
        this.props = props ? props : {} as IImageLayerProps;
        this.props.centring = Centring.Center;
        this.props.resize = true;
    }

    /**
     * @description Sets the source of the image, it can be like link to website or path to file.
     * @param src {string} - The `src` of the image.
     */
    setSrc(src: string) {
        if (!isImageUrlValid(src)) throw new LazyError('The src of the image must be a valid URL');
        this.props.src = src;
        return this;
    }

    /**
     * @description Set the size of the image. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param width {ScaleType} - The `width` of the image.
     * @param height {ScaleType} - The `height` of the image.
     * @param radius {ScaleType} - The `radius` of the image. (optional)
     */
    setSize(width: ScaleType, height: ScaleType, radius?: ScaleType) {
        this.props.size = {
            width: width,
            height: height,
            radius: radius || 0,
        };
        return this;
    }

    dontResize() {
        this.props.resize = false;
        return this;
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width }
        })

        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

        const r = parcer.parse(this.props.size.radius, defaultArg.wh(w / 2, h / 2), defaultArg.vl(false, true))

        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);

        if (debug) LazyLog.log('none', `ImageLayer:`, { x, y, w, h, r });

        ctx.save();
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);
        let image = await loadImage(this.props.src);
        image.width = w;
        image.height = h;
        if (!image) throw new LazyError('The image could not be loaded');
        if (r) {
            ctx.beginPath();
            ctx.moveTo(x + (w /2), y);
            ctx.arcTo(x + w, y, x + w, y + (h / 2), r);
            ctx.arcTo(x + w, y + h, x + (w / 2), y + h, r);
            ctx.arcTo(x, y + h, x, y + (h / 2), r);
            ctx.arcTo(x, y, x + (w / 2), y, r);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(image, x, y, w, h);
        } else {
            ctx.drawImage(image, x, y, w, h);
        }
        ctx.restore();
    }

    /**
     * @returns {IImageLayer}
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

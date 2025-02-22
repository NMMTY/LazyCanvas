import { BaseLayer } from "./BaseLayer";
import { IImageLayer, IImageLayerProps, ScaleType } from "../../types";
import { Centring, LayerType } from "../../types/enum";
import { Canvas, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import { centring, drawShadow, filters, isImageUrlValid, opacity, parseToNormal, transform } from "../../utils/utils";
import {LazyError, LazyLog} from "../../utils/LazyUtil";
import * as jimp from "jimp";
import {LayersManager} from "../managers/LayersManager";

export class ImageLayer extends BaseLayer<IImageLayerProps> {
    props: IImageLayerProps;

    constructor(props?: IImageLayerProps) {
        super(LayerType.Image, props);
        this.props = props ? props : {} as IImageLayerProps;
        this.props.centring = Centring.Center;
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

    async draw(ctx: SKRSContext2D, canvas: Canvas, manager: LayersManager, debug: boolean) {
        let xs = parseToNormal(this.props.x, ctx, canvas);
        let ys = parseToNormal(this.props.y, ctx, canvas, { width: 0, height: 0 }, { vertical: true });
        let w = parseToNormal(this.props.size.width, ctx, canvas);
        let h = parseToNormal(this.props.size.height, ctx, canvas, { width: w, height: 0 }, { vertical: true });
        let r = parseToNormal(this.props.size.radius, ctx, canvas, { width: w, height: h }, { layer: true });
        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);

        if (debug) LazyLog.log('none', `ImageLayer:`, { x, y, w, h, r });

        ctx.save();
        transform(ctx, this.props.transform, { width: w, height: h, x, y, type: this.type });
        drawShadow(ctx, this.props.shadow);
        opacity(ctx, this.props.opacity);
        filters(ctx, this.props.filter);
        let jmp = await jimp.read(this.props.src);
        jmp.resize(w, h);
        let image = await loadImage(await jmp.getBufferAsync('image/png'));
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
        data.props = this.props;
        return { ...data } as IImageLayer;
    }

}

import { Export } from "../../types/enum";
import { AnyExport, AnyLayer, IRenderManager } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { SKRSContext2D } from "@napi-rs/canvas";
import { Group } from "../components/Group";
import { LazyLog } from "../../utils/LazyUtil";
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export class RenderManager implements IRenderManager {
    lazyCanvas: LazyCanvas;
    debug: boolean;

    constructor(lazyCanvas: LazyCanvas, debug: boolean = false) {
        this.lazyCanvas = lazyCanvas;
        this.debug = debug;
    }

    private async renderLayer(layer: AnyLayer) {
        if (this.debug) LazyLog.log('info', `Rendering ${layer.id}...\nData:`, layer.toJSON());
        if (layer.visible) {
            if (layer instanceof Group) {
                for (const subLayer of layer.components) {
                    if (subLayer.visible) {
                        if ('globalComposite' in subLayer.props && subLayer.props.globalComposite) this.lazyCanvas.ctx.globalCompositeOperation= subLayer.props.globalComposite;
                        else this.lazyCanvas.ctx.globalCompositeOperation = 'source-over';
                        await subLayer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.layers, this.debug);
                    }
                }
            } else {
                if ('globalComposite' in layer.props && layer.props.globalComposite) this.lazyCanvas.ctx.globalCompositeOperation= layer.props.globalComposite;
                else this.lazyCanvas.ctx.globalCompositeOperation = 'source-over';
                await layer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.layers, this.debug);
            }
            this.lazyCanvas.ctx.shadowColor = 'transparent';
        }
        return this.lazyCanvas.ctx
    }

    private async renderStatic(exportType: AnyExport): Promise<Buffer | SKRSContext2D> {

        if (this.debug) LazyLog.log('info', `Rendering static...`);

        for (const layer of this.lazyCanvas.layers.toArray()) {
            await this.renderLayer(layer);
        }

        switch (exportType) {
            case Export.Buffer:
            case "buffer":
                return this.lazyCanvas.canvas.toBuffer('image/png');
            case Export.CTX:
            case "ctx":
                return this.lazyCanvas.ctx;
            case Export.SVG:
            case "svg":
                // @ts-ignore
                return this.lazyCanvas.canvas.getContent().toString('utf8');
            default:
                return this.lazyCanvas.canvas.toBuffer('image/png');
        }
    }

    private async renderAnimation(): Promise<Buffer> {
        const encoder = new GIFEncoder();

        if (this.debug) LazyLog.log('info', `Rendering animation...\nData:`, this.lazyCanvas.animation.opts);

        for (const layer of this.lazyCanvas.layers.toArray()) {
            const ctx = await this.renderLayer(layer);
            let { data, width, height } = ctx.getImageData(0, 0, this.lazyCanvas.width, this.lazyCanvas.height);
            const palette = quantize(data, this.lazyCanvas.animation.opts.maxColors, {format: this.lazyCanvas.animation.opts.colorSpace});
            const index = applyPalette(data, palette, this.lazyCanvas.animation.opts.colorSpace);
            encoder.writeFrame(index, width, height, {
                palette,
                transparent: this.lazyCanvas.animation.opts.transparency,
                delay: 1000 / this.lazyCanvas.animation.opts.frameRate,
                loop: this.lazyCanvas.animation.opts.loop
            });
            if (this.lazyCanvas.animation.opts.clear) ctx.clearRect(0, 0, this.lazyCanvas.width, this.lazyCanvas.height);
        }
        encoder.finish();
        return encoder.bytesView();
    }

    /**
     * This will render all the layers and return the rendered canvas buffer or ctx.
     * @returns {Promise<Buffer | SKRSContext2D>}
     */
    public async render(): Promise<Buffer | SKRSContext2D> {
        switch (this.lazyCanvas.exportType) {
            case Export.Buffer:
            case "buffer":
                if (this.lazyCanvas.animation.animated) {
                    return await this.renderAnimation();
                } else {
                    return await this.renderStatic(Export.Buffer);
                }
            case Export.CTX:
            case "ctx":
                return this.lazyCanvas.ctx;
            case Export.SVG:
            case "svg":
                return this.renderStatic(Export.SVG);
            default:
                return this.renderStatic(Export.Buffer);
        }
    }


}

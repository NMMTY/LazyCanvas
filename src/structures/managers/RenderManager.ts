import { Export } from "../../types/enum";
import { AnyExport, AnyLayer } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Group } from "../components";
import { LazyLog } from "../../utils/LazyUtil";
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export interface IRenderManager {
    lazyCanvas: LazyCanvas;
    debug: boolean;
}

export class RenderManager implements IRenderManager {
    lazyCanvas: LazyCanvas;
    debug: boolean;

    constructor(lazyCanvas: LazyCanvas, opts?: { debug?: boolean }) {
        this.lazyCanvas = lazyCanvas;
        this.debug = opts?.debug || false;
    }

    private mergeImageData(ctx: SKRSContext2D, imageDataList: ImageData[], width: number, height: number): ImageData {
        const mergedData = ctx.createImageData(width, height);
        const mergedPixels = mergedData.data;


        for (const imageData of imageDataList) {
            const pixels = imageData.data;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3] / 255;

                const existingAlpha = mergedPixels[i + 3] / 255;
                const newAlpha = a + existingAlpha * (1 - a);

                if (newAlpha > 0) {
                    mergedPixels[i] = (r * a + mergedPixels[i] * existingAlpha * (1 - a)) / newAlpha;
                    mergedPixels[i + 1] = (g * a + mergedPixels[i + 1] * existingAlpha * (1 - a)) / newAlpha;
                    mergedPixels[i + 2] = (b * a + mergedPixels[i + 2] * existingAlpha * (1 - a)) / newAlpha;
                    mergedPixels[i + 3] = newAlpha * 255;
                }
            }
        }

        return mergedData;
    }

    private async renderLayer(layer: AnyLayer | Group) {
        if (this.debug) LazyLog.log('info', `Rendering ${layer.id}...\nData:`,layer.toJSON());
        if (layer.visible) {
            if (layer instanceof Group) {
                for (const subLayer of layer.layers) {
                    if (subLayer.visible) {
                        if ('globalComposite' in subLayer.props && subLayer.props.globalComposite) this.lazyCanvas.ctx.globalCompositeOperation = subLayer.props.globalComposite;
                        else this.lazyCanvas.ctx.globalCompositeOperation = 'source-over';
                        await subLayer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.manager.layers, this.debug);
                    }
                }
            } else {
                if ('globalComposite' in layer.props && layer.props.globalComposite) this.lazyCanvas.ctx.globalCompositeOperation = layer.props.globalComposite;
                else this.lazyCanvas.ctx.globalCompositeOperation = 'source-over';
                await layer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.manager.layers, this.debug);
            }
            this.lazyCanvas.ctx.shadowColor = 'transparent';
        }
        return this.lazyCanvas.ctx
    }

    private async renderStatic(exportType: AnyExport): Promise<Buffer | SKRSContext2D | string> {

        if (this.debug) LazyLog.log('info', `Rendering static...`);

        for (const layer of this.lazyCanvas.manager.layers.toArray()) {
            await this.renderLayer(layer);
        }

        switch (exportType) {
            case Export.BUFFER:
            case "buffer":
            case Export.SVG:
            case "svg":
                if ('getContent' in this.lazyCanvas.canvas) {
                    return this.lazyCanvas.canvas.getContent().toString('utf8');
                }
                return this.lazyCanvas.canvas.toBuffer('image/png');
            case Export.CTX:
            case "ctx":
                return this.lazyCanvas.ctx;
            default:
                if ('getContent' in this.lazyCanvas.canvas) {
                    return this.lazyCanvas.canvas.getContent().toString('utf8');
                }
                return this.lazyCanvas.canvas.toBuffer('image/png');
        }
    }

    private async renderAnimation(): Promise<Buffer> {
        const encoder = new GIFEncoder();

        if (this.debug) LazyLog.log('info', `Rendering animation...\nData:`, this.lazyCanvas.manager.animation.options);

        const frameBuffer = [];
        const { width, height } = this.lazyCanvas.options;

        const delay = 1000 / this.lazyCanvas.manager.animation.options.frameRate;
        const { loop, colorSpace, maxColors, transparency, utils } = this.lazyCanvas.manager.animation.options;

        for (const layer of this.lazyCanvas.manager.layers.toArray()) {
            const ctx = await this.renderLayer(layer);

            frameBuffer.push(ctx.getImageData(0, 0, width, height));
            if (frameBuffer.length > utils.buffer.size) {
                frameBuffer.shift();
            }

            const mergeData = this.mergeImageData(ctx, frameBuffer, width, height);

            const palette = quantize(mergeData.data, maxColors, { format: colorSpace });
            const index = applyPalette(mergeData.data, palette, colorSpace);
            encoder.writeFrame(index, width, height, {
                palette,
                transparent: transparency,
                delay,
                loop
            });

            if (utils.clear) ctx.clearRect(0, 0, width, height);
        }
        encoder.finish();
        return encoder.bytesView();
    }

    /**
     * This will render all the layers and return the rendered canvas buffer or ctx.
     * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>}
     */
    public async render(format: AnyExport): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string> {
        switch (format) {
            case Export.BUFFER:
            case "buffer":
                if (this.lazyCanvas.options.animated) {
                    return await this.renderAnimation();
                } else {
                    return await this.renderStatic(Export.BUFFER);
                }
            case Export.CTX:
            case "ctx":
                return this.lazyCanvas.ctx;
            case Export.SVG:
            case "svg":
                return this.renderStatic(Export.SVG);
            case Export.CANVAS:
            case "canvas":
                await this.renderStatic(this.lazyCanvas.options.exportType === 'svg' ? Export.SVG : Export.BUFFER);
                return this.lazyCanvas.canvas;
            default:
                return this.renderStatic(Export.BUFFER);
        }
    }


}

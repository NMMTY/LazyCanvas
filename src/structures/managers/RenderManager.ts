import { AnyExport, AnyLayer, Export } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Group } from "../components";
import { LazyLog } from "../../utils/LazyUtil";
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from "gifenc";

/**
 * Interface representing the RenderManager.
 */
export interface IRenderManager {
    /**
     * The LazyCanvas instance used for rendering.
     */
    lazyCanvas: LazyCanvas;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;
}

/**
 * Class responsible for managing rendering operations, including static and animated exports.
 */
export class RenderManager implements IRenderManager {
    /**
     * The LazyCanvas instance used for rendering.
     */
    lazyCanvas: LazyCanvas;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Constructs a new RenderManager instance.
     * @param lazyCanvas {LazyCanvas} - The LazyCanvas instance to use for rendering.
     * @param opts {Object} - Optional settings for the RenderManager.
     * @param opts.debug {boolean} - Whether debugging is enabled.
     */
    constructor(lazyCanvas: LazyCanvas, opts?: { debug?: boolean }) {
        this.lazyCanvas = lazyCanvas;
        this.debug = opts?.debug || false;
    }

    /**
     * Merges multiple ImageData objects into a single ImageData object.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param imageDataList {ImageData[]} - The list of ImageData objects to merge.
     * @param width {number} - The width of the resulting ImageData.
     * @param height {number} - The height of the resulting ImageData.
     * @returns {ImageData} The merged ImageData object.
     */
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

    /**
     * Renders a single layer or group of layers.
     * @param layer {AnyLayer | Group} - The layer or group to render.
     * @returns {Promise<SKRSContext2D>} The canvas rendering context after rendering.
     */
    private async renderLayer(layer: AnyLayer | Group): Promise<SKRSContext2D> {
        if (this.debug) LazyLog.log('info', `Rendering ${layer.id}...\nData:`, layer.toJSON());
        if (layer.visible) {
            this.lazyCanvas.ctx.globalCompositeOperation = layer.props?.globalComposite || 'source-over';

            await layer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.manager.layers, this.debug);

            this.lazyCanvas.ctx.shadowColor = 'transparent';
        }
        return this.lazyCanvas.ctx;
    }

    /**
     * Renders all layers statically and exports the result in the specified format.
     * @param exportType {AnyExport} - The export format (e.g., buffer, SVG, or context).
     * @returns {Promise<Buffer | SKRSContext2D | string>} The rendered output in the specified format.
     */
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

    /**
     * Renders an animated sequence of layers and exports it as a GIF.
     * @returns {Promise<Buffer>} The rendered animation as a Buffer.
     */
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
     * Renders all layers and exports the result in the specified format.
     * @param format {AnyExport} - The export format (e.g., buffer, context, SVG, or canvas).
     * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>} The rendered output in the specified format.
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
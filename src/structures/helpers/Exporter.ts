import { IOLazyCanvas, LazyCanvas } from "../LazyCanvas";
import { AnyExport, Extensions, Export } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LazyError } from "../../utils/LazyUtil";
import * as fs from "fs";
import { generateRandomName } from "../../utils/utils";
import { LayersManager } from "../managers/LayersManager";
import * as _yaml from 'js-yaml';

export class Exporter {
    canvas: LazyCanvas;

    constructor(canvas: LazyCanvas) {
        this.canvas = canvas;
    }

    private async saveFile(buffer: any, extension: Extensions, name?: string) {
        if (!buffer) throw new LazyError('Buffer must be provided');
        if (!extension) throw new LazyError('Extension must be provided');

        fs.writeFileSync(`${name === undefined ? generateRandomName() : name }.${extension}`, buffer);
    }

    // Okay, I have to add this shit in here, just because I'm too bad.
    private exportLayers(manager: LayersManager): any[] {
        let arr = []
        for (const layer of Array.from(manager.map.values())) {
            arr.push(layer.toJSON())
        }
        return arr;
    }

    /**
     * Get the export
     * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>} - The `export` of the canvas
     */
    async export(exportType: AnyExport, opts?: { name?: string, saveAsFile?: boolean }): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string > {
        switch (exportType) {
            case Export.CTX:
            case "ctx":
                return await this.canvas.manager.render.render(exportType);
            case Export.SVG:
            case "svg":
                const svg = await this.canvas.manager.render.render(exportType);
                if (opts?.saveAsFile) {
                    await this.saveFile(svg, 'svg', opts.name);
                }
                return svg;
            case Export.BUFFER:
            case "buffer":
                const buffer = await this.canvas.manager.render.render(exportType);
                if (opts?.saveAsFile) {
                    await this.saveFile(buffer, 'png', opts.name);
                }
                return buffer;
            case Export.GIF:
            case "gif":
                const gif = await this.canvas.manager.render.render(exportType);
                if (opts?.saveAsFile) {
                    await this.saveFile(gif, 'gif', opts.name);
                }
                return gif;
            case Export.WEBP:
            case "webp":
                const webp = await this.canvas.manager.render.render(exportType);
                if (opts?.saveAsFile) {
                    await this.saveFile(webp, 'webp', opts.name);
                }
                return webp;
            case Export.JPEG:
            case "jpeg":
                const jpeg = await this.canvas.manager.render.render(exportType);
                await this.saveFile(jpeg, 'jpeg', opts?.name);
                return jpeg;
            case Export.JPG:
            case "jpg":
                const jpg = await this.canvas.manager.render.render(exportType);
                await this.saveFile(jpg, 'jpg', opts?.name);
                return jpg;
            case Export.PNG:
            case "png":
                const png = await this.canvas.manager.render.render(exportType);
                await this.saveFile(png, 'png', opts?.name);
                return png;
            case Export.JSON:
            case "json":
                const json = this.syncExport(exportType);
                if (opts?.saveAsFile) {
                    await this.saveFile(JSON.stringify(json), 'json', opts.name);
                }
                return JSON.stringify(json);
            case Export.CANVAS:
            case "canvas":
                return await this.canvas.manager.render.render(exportType) as unknown as Canvas | SvgCanvas;
            case Export.YAML:
            case "yaml":
                const yaml = _yaml.dump(this.syncExport(Export.JSON));
                if (opts?.saveAsFile) {
                    await this.saveFile(yaml, 'yaml', opts.name);
                }
                return yaml;
            default:
                throw new LazyError(`Export type ${exportType} is not supported`);
        }
    }

    /**
     * Get the export
     * @returns {Promise<IOLazyCanvas | void>} - The `export` of the canvas
     */
    syncExport(exportType: AnyExport): IOLazyCanvas | void {
        switch (exportType) {
            case Export.JSON:
            case "json":
                return {
                    options: this.canvas.options,
                    animation: this.canvas.manager.animation.options,
                    layers: this.exportLayers(this.canvas.manager.layers)
                };
        }
    }
}
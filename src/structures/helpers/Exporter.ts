import { IOLazyCanvas, LazyCanvas } from "../LazyCanvas";
import { AnyExport, Extensions, Export } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LazyError } from "../../utils/LazyUtil";
import * as fs from "fs";
import { generateRandomName } from "../../utils/utils";
import { LayersManager } from "../managers/LayersManager";
import * as _yaml from 'js-yaml';

/**
 * Class responsible for exporting a LazyCanvas instance to various formats.
 */
export class Exporter {
    /**
     * The LazyCanvas instance to be exported.
     */
    canvas: LazyCanvas;

    /**
     * Constructs a new Exporter instance.
     * @param canvas {LazyCanvas} - The LazyCanvas instance to be exported.
     */
    constructor(canvas: LazyCanvas) {
        this.canvas = canvas;
    }

    /**
     * Saves a file to the filesystem.
     * @param buffer {any} - The data to be saved.
     * @param extension {Extensions} - The file extension.
     * @param name {string} - The name of the file (optional).
     * @throws {LazyError} If the buffer or extension is not provided.
     */
    private async saveFile(buffer: any, extension: Extensions, name?: string) {
        if (!buffer) throw new LazyError('Buffer must be provided');
        if (!extension) throw new LazyError('Extension must be provided');

        fs.writeFileSync(`${name === undefined ? generateRandomName() : name}.${extension}`, buffer);
    }

    /**
     * Exports all layers from the LayersManager as an array of JSON objects.
     * @param manager {LayersManager} - The LayersManager instance.
     * @returns {any[]} An array of JSON representations of the layers.
     */
    private exportLayers(manager: LayersManager): any[] {
        let arr = [];
        for (const layer of Array.from(manager.map.values())) {
            arr.push(layer.toJSON());
        }
        return arr;
    }

    /**
     * Exports the canvas to the specified format.
     * @param exportType {AnyExport} - The type of export (e.g., "png", "json").
     * @param opts {Object} - Optional settings.
     * @param opts.name {string} - The name of the file (optional).
     * @param opts.saveAsFile {boolean} - Whether to save the export as a file (optional).
     * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>} The exported data.
     * @throws {LazyError} If the export type is not supported.
     */
    async export(exportType: AnyExport, opts?: { name?: string, saveAsFile?: boolean }): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string> {
        switch (exportType) {
            case Export.CTX:
            case "ctx":
                return await this.canvas.manager.render.render(exportType);
            case Export.SVG:
            case "svg":
                const svg = await this.canvas.manager.render.render('svg');
                if (opts?.saveAsFile) {
                    await this.saveFile(svg, 'svg', opts.name);
                }
                return svg;
            case Export.BUFFER:
            case "buffer":
                const buffer = await this.canvas.manager.render.render('buffer');
                if (opts?.saveAsFile) {
                    await this.saveFile(buffer, 'png', opts.name);
                }
                return buffer;
            case Export.GIF:
            case "gif":
                const gif = await this.canvas.manager.render.render('buffer');
                if (opts?.saveAsFile) {
                    await this.saveFile(gif, 'gif', opts.name);
                }
                return gif;
            case Export.WEBP:
            case "webp":
                const webp = await this.canvas.manager.render.render('buffer');
                if (opts?.saveAsFile) {
                    await this.saveFile(webp, 'webp', opts.name);
                }
                return webp;
            case Export.JPEG:
            case "jpeg":
                const jpeg = await this.canvas.manager.render.render('buffer');
                await this.saveFile(jpeg, 'jpeg', opts?.name);
                return jpeg;
            case Export.JPG:
            case "jpg":
                const jpg = await this.canvas.manager.render.render('buffer');
                await this.saveFile(jpg, 'jpg', opts?.name);
                return jpg;
            case Export.PNG:
            case "png":
                const png = await this.canvas.manager.render.render('buffer');
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
     * Synchronously exports the canvas to the specified format.
     * @param exportType {AnyExport} - The type of export (e.g., "json").
     * @returns {IOLazyCanvas | void} The exported data or void if the export type is unsupported.
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
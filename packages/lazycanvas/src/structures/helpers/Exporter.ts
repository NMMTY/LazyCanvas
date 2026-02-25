import { IOLazyCanvas, LazyCanvas } from "../LazyCanvas";
import { AnyExport, Export, Extensions } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LazyError, generateRandomName } from "../../utils";
import * as fs from "node:fs";
import { LayersManager } from "../managers";
import * as _yaml from "js-yaml";
import APNGEncoder from "../../utils/APNGEncoder";
import { Scene } from "../../core";

/**
 * Class responsible for exporting a LazyCanvas or Scene instance to various formats.
 */
export class Exporter {
  /**
   * The LazyCanvas instance to be exported.
   */
  canvas?: LazyCanvas;

  /**
   * The Scene instance to be exported.
   */
  scene?: Scene;

  /**
   * Constructs a new Exporter instance.
   * @param source {LazyCanvas | Scene} - The LazyCanvas or Scene instance to be exported.
   */
  constructor(source: LazyCanvas | Scene) {
    if (source instanceof Scene) {
      this.scene = source;
      this.canvas = source.lazyCanvas;
    } else {
      this.canvas = source;
    }
  }

  /**
   * Saves a file to the filesystem.
   * @param {any} [buffer] - The data to be saved.
   * @param {Extensions} [extension] - The file extension.
   * @param {string} [name] - The name of the file (optional).
   * @throws {LazyError} If the buffer or extension is not provided.
   */
  private async saveFile(buffer: any, extension: Extensions, name?: string) {
    if (!buffer) throw new LazyError("Buffer must be provided");
    if (!extension) throw new LazyError("Extension must be provided");

    fs.writeFileSync(`${name === undefined ? generateRandomName() : name}.${extension}`, buffer);
  }

  /**
   * Exports all layers from the LayersManager as an array of JSON objects.
   * @param {LayersManager} [manager] - The LayersManager instance.
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
   * @param {AnyExport} [exportType] - The type of export (e.g., "png", "json").
   * @param {Object} [opts] - Optional settings.
   * @param {string} [opts.name] - The name of the file (optional).
   * @param {boolean} [opts.saveAsFile] - Whether to save the export as a file (optional).
   * @param {number} [opts.duration] - Duration of the animation in seconds (Scene only).
   * @param {number} [opts.fps] - Frames per second for animation (default: 60, Scene only).
   * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>} The exported data.
   * @throws {LazyError} If the export type is not supported.
   */
  async export(
    exportType: AnyExport,
    opts?: {
      name?: string;
      saveAsFile?: boolean;
      duration?: number;
      fps?: number;
    },
  ): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string> {
    if (!this.canvas) {
      throw new LazyError("Canvas is not initialized");
    }

    let result;
    switch (exportType) {
      case Export.CTX:
      case "ctx":
        result = await this.canvas.manager.render.render(exportType);
        break;
      case Export.SVG:
      case "svg":
        result = await this.canvas.manager.render.render("svg");
        if (opts?.saveAsFile) {
          await this.saveFile(result, "svg", opts.name);
        }
        break;
      case Export.BUFFER:
      case "buffer":
        if (this.scene) {
          result = await this.scene.renderFirstFrame().then((frame) => frame.toBuffer("image/png"));
        } else {
          result = (await this.canvas.manager.render.render("buffer")) as Buffer;
        }
        if (opts?.saveAsFile) {
          await this.saveFile(result, "png", opts.name);
        }
        break;
      case Export.WEBP:
      case "webp":
        if (this.scene) {
          result = await this.scene
            .renderFirstFrame()
            .then((frame) => frame.toBuffer("image/webp"));
        } else {
          result = await this.canvas.manager.render.render("webp");
        }
        if (opts?.saveAsFile) {
          await this.saveFile(result, "webp", opts.name);
        }
        break;
      case Export.JPG:
      case "jpg":
        if (this.scene) {
          result = await this.scene
            .renderFirstFrame()
            .then((frame) => frame.toBuffer("image/jpeg"));
        } else {
          result = await this.canvas.manager.render.render("jpg");
        }
        await this.saveFile(result, "jpg", opts?.name);
        return result;
      case Export.PNG:
      case "png":
        if (this.scene) {
          result = await this.scene.renderFirstFrame().then((frame) => frame.toBuffer("image/png"));
        } else {
          result = await this.canvas.manager.render.render("png");
        }
        await this.saveFile(result, "png", opts?.name);
        return result;
      case Export.APNG:
      case "apng":
        if (!this.scene) {
          throw new LazyError("APNG export requires a Scene instance. Use: new Exporter(scene)");
        }

        const duration = opts?.duration ?? 0;
        const timeNow = Date.now();
        const fps = opts?.fps ?? 60;

        const frameData = await this.scene.renderAnimationData(timeNow, timeNow + duration, fps);

        const encoder = new APNGEncoder(this.scene.width, this.scene.height, fps).addFrames(
          ...frameData,
        );
        const buffer = encoder.encode();

        if (opts?.saveAsFile !== false) {
          fs.writeFileSync(`${opts?.name ?? "animation"}.png`, buffer);
        }
        return buffer;
      case Export.JSON:
      case "json":
        const json = this.syncExport(exportType);
        if (opts?.saveAsFile) {
          await this.saveFile(JSON.stringify(json), "json", opts.name);
        }
        return JSON.stringify(json);
      case Export.CANVAS:
      case "canvas":
        return (await this.canvas.manager.render.render(exportType)) as unknown as
          | Canvas
          | SvgCanvas;
      case Export.YAML:
      case "yaml":
        const yaml = _yaml.dump(this.syncExport(Export.JSON));
        if (opts?.saveAsFile) {
          await this.saveFile(yaml, "yaml", opts.name);
        }
        return yaml;
      default:
        throw new LazyError(`Export type ${exportType} is not supported`);
    }
    return result;
  }

  /**
   * Synchronously exports the canvas to the specified format.
   * @param {AnyExport} [exportType] - The type of export (e.g., "json").
   * @returns {IOLazyCanvas | void} The exported data or void if the export type is unsupported.
   */
  syncExport(exportType: AnyExport): IOLazyCanvas | void {
    if (!this.canvas) {
      throw new LazyError("Canvas is not initialized");
    }

    switch (exportType) {
      case Export.JSON:
      case "json":
        return {
          options: this.canvas.options,
          layers: this.exportLayers(this.canvas.manager.layers),
        };
    }
  }
}

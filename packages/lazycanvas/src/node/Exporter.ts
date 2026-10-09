import * as fs from "node:fs";
import * as _yaml from "js-yaml";
import { Scene } from "../core";
import type { IOLazyCanvas, LazyCanvas } from "../structures/LazyCanvas";
import { serializeCanvas } from "../structures/helpers/serialize";
import { type AnyExport, Export, type Extensions } from "../types";
import { LazyError, generateRandomName } from "../utils";
import { APNGEncoder } from "./APNGEncoder";

/**
 * Options accepted by {@link Exporter.export}.
 */
export interface IExportOptions {
  /**
   * File name (without extension) used when `saveAsFile` is enabled.
   * Defaults to a random name.
   */
  name?: string;

  /**
   * Whether the result should also be written to disk. Defaults to `false` for
   * every format.
   */
  saveAsFile?: boolean;

  /**
   * Animation length in seconds. Only used by the `apng` format.
   */
  duration?: number;

  /**
   * Frames per second. Only used by the `apng` format.
   */
  fps?: number;
}

/**
 * File extension written to disk for each export format.
 */
const FILE_EXTENSION: Partial<Record<string, Extensions>> = {
  [Export.BUFFER]: "png",
  [Export.PNG]: "png",
  [Export.APNG]: "png",
  [Export.JPG]: "jpg",
  [Export.WEBP]: "webp",
  [Export.JSON]: "json",
  [Export.YAML]: "yaml",
};

/**
 * Exports a {@link LazyCanvas} or {@link Scene} to a buffer, a serialized
 * document, or a file on disk.
 *
 * NOTE: This is a Node.js-only class, available from `@nmmty/lazycanvas/node`.
 * In the browser render to a canvas directly and read it back with
 * `canvas.toDataURL()`.
 */
export class Exporter {
  canvas: LazyCanvas;
  scene?: Scene;

  constructor(source: LazyCanvas | Scene) {
    if (source instanceof Scene) {
      this.scene = source;
      this.canvas = source.lazyCanvas;
    } else {
      this.canvas = source;
    }
  }

  /**
   * Writes a buffer or string to disk.
   * @throws {LazyError} If no data or extension was provided.
   */
  private saveFile(data: any, extension: Extensions, name?: string): void {
    if (data === undefined || data === null) throw new LazyError("Buffer must be provided");
    if (!extension) throw new LazyError("Extension must be provided");

    fs.writeFileSync(`${name ?? generateRandomName()}.${extension}`, data);
  }

  /**
   * Renders a single frame and encodes it in the given raster format.
   */
  private async renderRaster(format: AnyExport): Promise<any> {
    if (this.scene) {
      await this.scene.renderFrame(0);
      return this.scene.encode(format);
    }
    return this.canvas.manager.render.render(format);
  }

  /**
   * Exports the canvas or scene in the requested format.
   *
   * @param {AnyExport} [exportType] - The target format.
   * @param {IExportOptions} [opts] - Export options.
   * @returns {Promise<any>} The encoded result. Raster formats resolve to a
   * `Buffer` (Node canvas) or a data URL string, `json`/`yaml` to a string, and
   * `ctx`/`canvas` to the raw objects.
   * @throws {LazyError} If the format is not supported.
   */
  async export(exportType: AnyExport, opts?: IExportOptions): Promise<any> {
    const extension = FILE_EXTENSION[exportType as string];
    let result: any;

    switch (exportType) {
      case Export.CTX:
      case "ctx":
      case Export.CANVAS:
      case "canvas":
        return this.canvas.manager.render.render(exportType);

      case Export.BUFFER:
      case "buffer":
      case Export.PNG:
      case "png":
      case Export.JPG:
      case "jpg":
      case Export.WEBP:
      case "webp":
        result = await this.renderRaster(exportType);
        break;

      case Export.APNG:
      case "apng": {
        if (!this.scene) {
          throw new LazyError("APNG export requires a Scene instance. Use: new Exporter(scene)");
        }
        const frames = await this.scene.renderAnimationData(
          0,
          opts?.duration ?? 0,
          opts?.fps ?? 60,
        );
        result = new APNGEncoder(this.scene.width, this.scene.height, opts?.fps ?? 60)
          .addFrames(...frames)
          .encode();
        break;
      }

      case Export.JSON:
      case "json":
        result = JSON.stringify(this.syncExport(Export.JSON));
        break;

      case Export.YAML:
      case "yaml":
        result = _yaml.dump(this.syncExport(Export.JSON) as any);
        break;

      default:
        throw new LazyError(`Export type "${exportType}" is not supported`);
    }

    if (opts?.saveAsFile) {
      if (!extension) throw new LazyError(`Export type "${exportType}" cannot be saved to a file`);
      this.saveFile(result, extension, opts.name);
    }

    return result;
  }

  /**
   * Serializes the canvas synchronously. Only `json` is supported.
   *
   * @param {AnyExport} [exportType] - Must be `json`.
   * @returns {IOLazyCanvas | void} The serialized canvas.
   */
  syncExport(exportType: AnyExport): IOLazyCanvas | undefined {
    switch (exportType) {
      case Export.JSON:
      case "json":
        return serializeCanvas(this.canvas);
    }
  }
}

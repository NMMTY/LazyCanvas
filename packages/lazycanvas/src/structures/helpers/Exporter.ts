import { IOLazyCanvas, LazyCanvas } from "../LazyCanvas";
import { AnyExport, Export, Extensions } from "../../types";
import { LazyError, generateRandomName } from "../../utils";
import * as fs from "node:fs";
import { LayersManager } from "../managers";
import * as _yaml from "js-yaml";
import APNGEncoder from "../../utils/APNGEncoder";
import { Scene } from "../../core";

/**
 * Class responsible for exporting a LazyCanvas or Scene instance to various formats.
 * NOTE: This is a Node.js-only module. For browser use, render to canvas directly.
 */
export class Exporter {
  canvas?: LazyCanvas;
  scene?: Scene;

  constructor(source: LazyCanvas | Scene) {
    if (source instanceof Scene) {
      this.scene = source;
      this.canvas = source.lazyCanvas;
    } else {
      this.canvas = source;
    }
  }

  private async saveFile(buffer: any, extension: Extensions, name?: string) {
    if (!buffer) throw new LazyError("Buffer must be provided");
    if (!extension) throw new LazyError("Extension must be provided");

    fs.writeFileSync(`${name === undefined ? generateRandomName() : name}.${extension}`, buffer);
  }

  private exportLayers(manager: LayersManager): any[] {
    let arr = [];
    for (const layer of Array.from(manager.map.values())) {
      arr.push(layer.toJSON());
    }
    return arr;
  }

  async export(
    exportType: AnyExport,
    opts?: {
      name?: string;
      saveAsFile?: boolean;
      duration?: number;
      fps?: number;
    },
  ): Promise<any> {
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
          const frame = await this.scene.renderFirstFrame();
          const canvas = frame as any;
          result = canvas.toBuffer ? canvas.toBuffer("image/png") : canvas.toDataURL("image/png");
        } else {
          result = await this.canvas.manager.render.render("buffer");
        }
        if (opts?.saveAsFile) {
          await this.saveFile(result, "png", opts.name);
        }
        break;
      case Export.WEBP:
      case "webp":
        if (this.scene) {
          const frame = await this.scene.renderFirstFrame();
          const canvas = frame as any;
          result = canvas.toBuffer ? canvas.toBuffer("image/webp") : canvas.toDataURL("image/webp");
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
          const frame = await this.scene.renderFirstFrame();
          const canvas = frame as any;
          result = canvas.toBuffer ? canvas.toBuffer("image/jpeg") : canvas.toDataURL("image/jpeg");
        } else {
          result = await this.canvas.manager.render.render("jpg");
        }
        await this.saveFile(result, "jpg", opts?.name);
        return result;
      case Export.PNG:
      case "png":
        if (this.scene) {
          const frame = await this.scene.renderFirstFrame();
          const canvas = frame as any;
          result = canvas.toBuffer ? canvas.toBuffer("image/png") : canvas.toDataURL("image/png");
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
        const fps = opts?.fps ?? 60;

        const frameData = await this.scene.renderAnimationData(0, duration, fps);

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
        return await this.canvas.manager.render.render(exportType);
      case Export.YAML:
      case "yaml":
        const yaml = _yaml.dump(this.syncExport(Export.JSON) as any);
        if (opts?.saveAsFile) {
          await this.saveFile(yaml, "yaml", opts.name);
        }
        return yaml;
      default:
        throw new LazyError(`Export type ${exportType} is not supported`);
    }
    return result;
  }

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

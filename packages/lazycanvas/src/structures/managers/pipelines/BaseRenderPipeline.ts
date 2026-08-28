import { AnyExport, AnyLayer, Export, ICanvasRenderingContext2D } from "../../../types";
import { LazyCanvas } from "../../LazyCanvas";
import { Div } from "../../components";
import { LazyError, LazyLog } from "../../../utils/LazyUtil";
import { IRenderManager } from "./index";

/**
 * Mime type used by `canvas.toBuffer()` / `canvas.toDataURL()` for every raster
 * export format. `buffer` is an alias of `png` kept for backwards compatibility.
 */
const RASTER_MIME: Record<string, string> = {
  [Export.BUFFER]: "image/png",
  [Export.PNG]: "image/png",
  [Export.JPG]: "image/jpeg",
  [Export.WEBP]: "image/webp",
};

/**
 * Shared behaviour of every render pipeline: layer drawing, output encoding and
 * export-format dispatch. Concrete pipelines only decide *what* is drawn and in
 * which order by implementing {@link renderTree}.
 */
export abstract class BaseRenderPipeline implements IRenderManager {
  lazyCanvas: LazyCanvas;
  debug: boolean;

  constructor(lazyCanvas: LazyCanvas, opts?: { debug?: boolean }) {
    this.lazyCanvas = lazyCanvas;
    this.debug = opts?.debug || false;
  }

  /**
   * Draws the whole layer tree onto the canvas context.
   */
  protected abstract renderTree(): Promise<void>;

  /**
   * Draws a single layer. Shared by every pipeline.
   */
  protected async drawLayer(layer: AnyLayer | Div): Promise<ICanvasRenderingContext2D> {
    if (this.debug) LazyLog.log("info", `Rendering ${layer.id}...\nData:`, layer.toJSON());
    if (layer.visible) {
      this.lazyCanvas.ctx.globalCompositeOperation = layer.props?.globalComposite || "source-over";

      await layer.draw(
        this.lazyCanvas.ctx,
        this.lazyCanvas.canvas,
        this.lazyCanvas.manager.layers,
        this.debug,
        this.lazyCanvas.adapter,
      );

      this.lazyCanvas.ctx.shadowColor = "transparent";
    }
    return this.lazyCanvas.ctx;
  }

  /**
   * Encodes the already-rendered canvas into the requested format.
   *
   * @throws {LazyError} If the canvas implementation cannot encode raster output.
   */
  public encode(format: AnyExport): any {
    switch (format) {
      case Export.CTX:
      case "ctx":
        return this.lazyCanvas.ctx;
      case Export.CANVAS:
      case "canvas":
        return this.lazyCanvas.canvas;
      default: {
        const mime = RASTER_MIME[format as string];
        if (!mime) {
          throw new LazyError(`Render format "${format}" is not supported by this pipeline`);
        }
        const canvas = this.lazyCanvas.canvas as any;
        if (typeof canvas.toBuffer === "function") return canvas.toBuffer(mime);
        if (typeof canvas.toDataURL === "function") return canvas.toDataURL(mime);
        throw new LazyError(
          `The current canvas adapter cannot encode "${mime}": neither toBuffer() nor toDataURL() is available`,
        );
      }
    }
  }

  /**
   * Renders the scene and returns it in the requested format.
   *
   * @param {AnyExport} [format] - The output format.
   * @returns {Promise<any>} A buffer/data URL for raster formats, or the raw
   * context/canvas for `ctx` and `canvas`.
   */
  public async render(format: AnyExport): Promise<any> {
    if (this.debug) LazyLog.log("info", `Rendering static as "${format}"...`);
    await this.renderTree();
    return this.encode(format);
  }
}

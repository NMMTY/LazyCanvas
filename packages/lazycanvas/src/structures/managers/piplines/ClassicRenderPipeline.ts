import { AnyExport, AnyLayer, Export } from "../../../types";
import { LazyCanvas } from "../../LazyCanvas";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Div } from "../../components";
import { LazyLog } from "../../../utils/LazyUtil";
import { IRenderManager } from "./index";

/**
 * Class responsible for managing rendering operations, including static and animated exports.
 */
export class ClassicRenderPipeline implements IRenderManager {
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
   * @param {LazyCanvas} [lazyCanvas] - The LazyCanvas instance to use for rendering.
   * @param {Object} [opts] - Optional settings for the RenderManager.
   * @param {boolean} [opts.debug] - Whether debugging is enabled.
   */
  constructor(lazyCanvas: LazyCanvas, opts?: { debug?: boolean }) {
    this.lazyCanvas = lazyCanvas;
    this.debug = opts?.debug || false;
  }

  /**
   * Renders a single layer or group of layers.
   * @param {AnyLayer | Group} [layer] - The layer or group to render.
   * @returns {Promise<SKRSContext2D>} The canvas rendering context after rendering.
   */
  private async renderLayer(layer: AnyLayer | Div): Promise<SKRSContext2D> {
    if (this.debug) LazyLog.log("info", `Rendering ${layer.id}...\nData:`, layer.toJSON());
    if (layer.visible) {
      this.lazyCanvas.ctx.globalCompositeOperation = layer.props?.globalComposite || "source-over";

      await layer.draw(
        this.lazyCanvas.ctx,
        this.lazyCanvas.canvas,
        this.lazyCanvas.manager.layers,
        this.debug,
      );

      this.lazyCanvas.ctx.shadowColor = "transparent";
    }
    return this.lazyCanvas.ctx;
  }

  /**
   * Renders all layers statically and exports the result in the specified format.
   * @param {AnyExport} [exportType] - The export format (e.g., buffer, SVG, or context).
   * @returns {Promise<Buffer | SKRSContext2D | string>} The rendered output in the specified format.
   */
  private async renderStatic(exportType: AnyExport): Promise<Buffer | SKRSContext2D | string> {
    if (this.debug) LazyLog.log("info", `Rendering static...`);

    for (const layer of this.lazyCanvas.manager.layers.toArray()) {
      await this.renderLayer(layer);
    }

    switch (exportType) {
      case Export.BUFFER:
      case "buffer":
      case Export.SVG:
      case "svg":
        if ("getContent" in this.lazyCanvas.canvas) {
          return this.lazyCanvas.canvas.getContent().toString("utf8");
        }
        return this.lazyCanvas.canvas.toBuffer("image/png");
      case Export.CTX:
      case "ctx":
        return this.lazyCanvas.ctx;
      default:
        if ("getContent" in this.lazyCanvas.canvas) {
          return this.lazyCanvas.canvas.getContent().toString("utf8");
        }
        return this.lazyCanvas.canvas.toBuffer("image/png");
    }
  }

  /**
   * Renders all layers and exports the result in the specified format.
   * @param {AnyExport} [format] - The export format (e.g., buffer, context, SVG, or canvas).
   * @returns {Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>} The rendered output in the specified format.
   */
  public async render(
    format: AnyExport,
  ): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string> {
    switch (format) {
      case Export.BUFFER:
      case "buffer":
        return await this.renderStatic(Export.BUFFER);
      case Export.CTX:
      case "ctx":
        return await this.renderStatic(Export.CTX);
      case Export.SVG:
      case "svg":
        return await this.renderStatic(Export.SVG);
      case Export.CANVAS:
      case "canvas":
        await this.renderStatic(
          this.lazyCanvas.options.exportType === "svg" ? Export.SVG : Export.BUFFER,
        );
        return this.lazyCanvas.canvas;
      default:
        return await this.renderStatic(Export.BUFFER);
    }
  }
}

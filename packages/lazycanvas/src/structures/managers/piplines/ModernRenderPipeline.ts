import { AnyExport, AnyLayer, Export } from "../../../types";
import { LazyCanvas } from "../../LazyCanvas";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Div } from "../../components";
import { LazyLog } from "../../../utils/LazyUtil";
import { IRenderManager } from "./index";

/**
 * Class responsible for managing rendering operations, including static and animated exports.
 */
export class ModernRenderPipeline implements IRenderManager {
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
   * @param {AnyLayer | Div} [layer] - The layer or group to render.
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

      // Draw children if any (and not a Div, as Div handles its own children)
      // Actually, if we want to support children on any layer, we should handle it here.
      // But Div.draw already handles children.
      // If we handle it here for Div, we get double rendering.
      // So we skip Div.

      const children = (layer as any).children;
      if (!(layer instanceof Div) && children && Array.isArray(children) && children.length > 0) {
        const ctx = this.lazyCanvas.ctx;
        ctx.save();

        // Apply parent position offset
        // LayoutManager sets position relative to parent.
        // We need to translate context to parent's position so children are drawn relative to it.

        // However, layer.draw() might have already drawn the layer at that position.
        // And layer.draw() usually restores context.

        // So we are back at parent's parent coordinate system.
        // We need to translate to layer's position.

        if (layer.props.position) {
          const x = typeof layer.props.position.x === "number" ? layer.props.position.x : 0;
          const y = typeof layer.props.position.y === "number" ? layer.props.position.y : 0;
          ctx.translate(x, y);
        }

        for (const child of children) {
          await this.renderLayer(child);
        }

        ctx.restore();
      }

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

    // Wait for layout engine to be ready
    await this.lazyCanvas.manager.layout.ready;

    const rootLayers = this.lazyCanvas.manager.layers.toArray().filter((l) => !l.parent);

    for (const layer of rootLayers) {
      this.lazyCanvas.manager.layout.calculateLayout(
        layer,
        this.lazyCanvas.options.width,
        this.lazyCanvas.options.height,
        this.lazyCanvas.ctx,
        this.lazyCanvas.canvas,
      );
    }

    for (const layer of rootLayers) {
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

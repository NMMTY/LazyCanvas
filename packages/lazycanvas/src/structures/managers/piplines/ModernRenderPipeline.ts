import { AnyExport, AnyLayer, Export, ICanvas, ICanvasRenderingContext2D } from "../../../types";
import { LazyCanvas } from "../../LazyCanvas";
import { Div } from "../../components";
import { LazyLog } from "../../../utils/LazyUtil";
import { IRenderManager } from "./index";

export class ModernRenderPipeline implements IRenderManager {
  lazyCanvas: LazyCanvas;
  debug: boolean;

  constructor(lazyCanvas: LazyCanvas, opts?: { debug?: boolean }) {
    this.lazyCanvas = lazyCanvas;
    this.debug = opts?.debug || false;
  }

  private async renderLayer(layer: AnyLayer | Div): Promise<ICanvasRenderingContext2D> {
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

      const children = (layer as any).children;
      if (!(layer instanceof Div) && children && Array.isArray(children) && children.length > 0) {
        const ctx = this.lazyCanvas.ctx;
        ctx.save();

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

  private async renderStatic(exportType: AnyExport): Promise<any> {
    if (this.debug) LazyLog.log("info", `Rendering static...`);

    // Don't block rendering on yoga-layout init.
    // calculateLayout gracefully handles yoga being null.
    // Layout will be applied on subsequent frames once yoga loads.

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
        if ("toBuffer" in this.lazyCanvas.canvas && typeof this.lazyCanvas.canvas.toBuffer === "function") {
          return this.lazyCanvas.canvas.toBuffer("image/png");
        }
        if ("toDataURL" in this.lazyCanvas.canvas && typeof this.lazyCanvas.canvas.toDataURL === "function") {
          return this.lazyCanvas.canvas.toDataURL("image/png");
        }
        return this.lazyCanvas.ctx;
      case Export.CTX:
      case "ctx":
        return this.lazyCanvas.ctx;
      case Export.CANVAS:
      case "canvas":
        return this.lazyCanvas.canvas;
      default:
        return this.lazyCanvas.ctx;
    }
  }

  public async render(format: AnyExport): Promise<any> {
    switch (format) {
      case Export.BUFFER:
      case "buffer":
        return await this.renderStatic(Export.BUFFER);
      case Export.CTX:
      case "ctx":
        return await this.renderStatic(Export.CTX);
      case Export.CANVAS:
      case "canvas":
        await this.renderStatic(Export.BUFFER);
        return this.lazyCanvas.canvas;
      default:
        return await this.renderStatic(Export.BUFFER);
    }
  }
}

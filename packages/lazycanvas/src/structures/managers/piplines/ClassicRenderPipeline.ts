import { AnyExport, AnyLayer, Export, ICanvas, ICanvasRenderingContext2D } from "../../../types";
import { LazyCanvas } from "../../LazyCanvas";
import { Div } from "../../components";
import { LazyLog } from "../../../utils/LazyUtil";
import { IRenderManager } from "./index";

export class ClassicRenderPipeline implements IRenderManager {
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

      this.lazyCanvas.ctx.shadowColor = "transparent";
    }
    return this.lazyCanvas.ctx;
  }

  private async renderStatic(exportType: AnyExport): Promise<any> {
    if (this.debug) LazyLog.log("info", `Rendering static...`);

    for (const layer of this.lazyCanvas.manager.layers.toArray()) {
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

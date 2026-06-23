import { LazyCanvas } from "../../LazyCanvas";
import { AnyExport, ICanvas, ICanvasRenderingContext2D } from "../../../types";

export interface IRenderManager {
  lazyCanvas: LazyCanvas;
  debug: boolean;
  render(format: AnyExport): Promise<any>;
}

export interface RenderManagerConstructor {
  new (lazyCanvas: LazyCanvas, opts?: { debug?: boolean }): IRenderManager;
}

export * from "./ClassicRenderPipeline";
export * from "./ModernRenderPipeline";

import { LazyCanvas } from "../../LazyCanvas";
import { AnyExport } from "../../../types";

export interface IRenderManager {
  lazyCanvas: LazyCanvas;
  debug: boolean;

  /**
   * Renders the layer tree and returns it encoded in the requested format.
   */
  render(format: AnyExport): Promise<any>;

  /**
   * Encodes what is already on the canvas, without rendering again.
   */
  encode(format: AnyExport): any;
}

export interface RenderManagerConstructor {
  new (lazyCanvas: LazyCanvas, opts?: { debug?: boolean }): IRenderManager;
}

export * from "./BaseRenderPipeline";
export * from "./ClassicRenderPipeline";
export * from "./ModernRenderPipeline";

import { LazyCanvas } from "../../LazyCanvas";
import { AnyExport } from "../../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";

/**
 * Interface representing the RenderManager.
 */
export interface IRenderManager {
  /**
   * The LazyCanvas instance used for rendering.
   */
  lazyCanvas: LazyCanvas;

  /**
   * Whether debugging is enabled.
   */
  debug: boolean;

  render(format: AnyExport): Promise<Buffer | SKRSContext2D | Canvas | SvgCanvas | string>;
}

export interface RenderManagerConstructor {
  new (lazyCanvas: LazyCanvas, opts?: { debug?: boolean }): IRenderManager;
}

export * from "./ClassicRenderPipeline";
export * from "./ModernRenderPipeline";

import { LazyCanvas } from "../structures/LazyCanvas";
import type { Div } from "../structures/components";
import { ModernRenderPipeline } from "../structures/managers";
import { type AnyExport, type AnyLayer, Export, type ICanvas, type ICanvasAdapter } from "../types";
import { walkLayers } from "../utils";
import type { Signal, ThreadGenerator } from "./Signal";
import { ThreadScheduler } from "./ThreadScheduler";

export class Scene {
  public readonly lazyCanvas: LazyCanvas;

  private allLayers: (AnyLayer | Div)[] = [];
  private scheduler: ThreadScheduler = new ThreadScheduler();
  private lastFrameTime = 0;

  constructor(
    width: number,
    height: number,
    opts: { debug?: boolean; adapter?: ICanvasAdapter } = {},
  ) {
    this.lazyCanvas = new LazyCanvas(ModernRenderPipeline, opts).create(width, height);
  }

  public load(tree: AnyLayer | Div): void {
    this.lazyCanvas.manager.layers.add(tree);
    this.allLayers = this.lazyCanvas.manager.layers.toArray();
  }

  public async renderFrame(time: number): Promise<void> {
    if (this.lazyCanvas.manager.layers.size() === 0) {
      throw new Error("Scene: No root layer loaded. Call scene.load(tree) first.");
    }

    if (this.lazyCanvas.manager.layout.ready) {
      await this.lazyCanvas.manager.layout.ready;
    }

    this.scheduler.update(time);

    this.lazyCanvas.ctx.clearRect(
      0,
      0,
      this.lazyCanvas.canvas.width,
      this.lazyCanvas.canvas.height,
    );

    this.updateAllStates(time);

    await this.lazyCanvas.manager.render.render(Export.CTX);

    this.lastFrameTime = time;
  }

  public async renderFirstFrame(): Promise<ICanvas> {
    await this.renderFrame(0);
    return this.lazyCanvas.canvas;
  }

  public getImageData(): Uint8ClampedArray {
    const imageData = this.lazyCanvas.ctx.getImageData(0, 0, this.width, this.height);
    return new Uint8ClampedArray(imageData.data);
  }

  public get width(): number {
    return this.lazyCanvas.canvas.width;
  }

  public get height(): number {
    return this.lazyCanvas.canvas.height;
  }

  private updateAllStates(time: number): void {
    for (const layer of walkLayers(this.allLayers)) {
      if ("updateState" in layer && typeof layer.updateState === "function") {
        (layer as { updateState(t: number): void }).updateState(time);
      }
    }
  }

  /**
   * Encodes whatever is currently on the canvas, without rendering a new frame.
   *
   * @param {AnyExport} [format] - The target format.
   * @returns {any} A buffer/data URL for raster formats, or the raw context/canvas.
   */
  public encode(format: AnyExport): any {
    return this.lazyCanvas.manager.render.encode(format);
  }

  public async renderAnimation(startTime: number, endTime: number, fps = 30): Promise<any[]> {
    const frames: any[] = [];
    const frameDuration = 1 / fps;

    for (let time = startTime; time <= endTime; time += frameDuration) {
      await this.renderFrame(time);
      const canvas = this.lazyCanvas.canvas;
      if ("toBuffer" in canvas && typeof canvas.toBuffer === "function") {
        frames.push(canvas.toBuffer("image/png"));
      } else if ("toDataURL" in canvas && typeof canvas.toDataURL === "function") {
        frames.push(canvas.toDataURL("image/png"));
      }
    }

    return frames;
  }

  public async renderAnimationData(
    startTime: number,
    endTime: number,
    fps = 30,
  ): Promise<Uint8ClampedArray[]> {
    const frames: Uint8ClampedArray[] = [];
    const frameDuration = 1 / fps;

    for (let time = startTime; time <= endTime; time += frameDuration) {
      await this.renderFrame(time);
      frames.push(this.getImageData());
    }

    return frames;
  }

  public getLayer(id: string): AnyLayer | Div | undefined {
    return this.lazyCanvas.manager.layers.get(id, true);
  }

  public addAnimation(generatorOrFactory: ThreadGenerator | (() => ThreadGenerator)): void {
    const gen =
      typeof generatorOrFactory === "function"
        ? (generatorOrFactory as () => ThreadGenerator)()
        : generatorOrFactory;
    this.scheduler.add(gen);
  }

  public playAnimation<T>(
    signal: Signal<T>,
    generatorOrFactory: ThreadGenerator | (() => ThreadGenerator),
  ): void {
    const gen =
      typeof generatorOrFactory === "function"
        ? (generatorOrFactory as () => ThreadGenerator)()
        : generatorOrFactory;
    signal.run(gen);
    this.scheduler.add(gen);
  }

  public clearAnimations(): void {
    this.scheduler.clear();
  }

  public resetTimeline(): void {
    this.scheduler.reset();
    this.lastFrameTime = 0;
  }

  public hasActiveAnimations(): boolean {
    return this.scheduler.hasActiveThreads();
  }
}

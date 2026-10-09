import { LazyCanvas } from "../structures/LazyCanvas";
import type { Div } from "../structures/components";
import { ModernRenderPipeline } from "../structures/managers";
import { type AnyExport, type AnyLayer, Export, type ICanvas, type ICanvasAdapter } from "../types";
import { walkLayers } from "../utils";
import type { Signal, ThreadGenerator } from "./Signal";
import { ThreadScheduler } from "./ThreadScheduler";

/**
 * A canvas, its layer tree and an animation timeline.
 *
 * `Scene` is the main entry point of LazyCanvas: create one with a size and an
 * adapter, {@link Scene.load | load} a layer tree, then render frames.
 *
 * @example
 * ```ts
 * const scene = new Scene(400, 200, { adapter: new NodeCanvasAdapter() });
 * scene.load(new MorphLayer({ color: "#22c55e", size: { width: 400, height: 200 } }));
 * await scene.renderFrame(0);
 * ```
 */
export class Scene {
  public readonly lazyCanvas: LazyCanvas;

  private allLayers: (AnyLayer | Div)[] = [];
  private scheduler: ThreadScheduler = new ThreadScheduler();
  private lastFrameTime = 0;

  /**
   * Tail of the render queue. Frames share one canvas context, and layers hold
   * `ctx.save()` across awaits (loading an image, resolving a fill), so two
   * frames running at once interleave their save/restore pairs: one frame's
   * `restore()` pops the other's state and clips and transforms leak between
   * them. Chaining every frame onto this promise keeps them strictly ordered.
   */
  private renderQueue: Promise<void> = Promise.resolve();

  /**
   * @param {number} width - The canvas width in pixels.
   * @param {number} height - The canvas height in pixels.
   * @param {object} [opts] - Options.
   * @param {ICanvasAdapter} opts.adapter - The canvas adapter for the current environment. Required.
   * @param {boolean} [opts.debug] - Enables verbose logging.
   * @throws {LazyError} If no adapter is given.
   */
  constructor(
    width: number,
    height: number,
    opts: { debug?: boolean; adapter?: ICanvasAdapter } = {},
  ) {
    this.lazyCanvas = new LazyCanvas(ModernRenderPipeline, opts).create(width, height);
  }

  /**
   * Adds a layer, or a tree of layers under a `Div`, to the scene.
   *
   * Call it once per root layer before rendering.
   *
   * @param {AnyLayer | Div} tree - The root layer.
   */
  public load(tree: AnyLayer | Div): void {
    this.lazyCanvas.manager.layers.add(tree);
    this.allLayers = this.lazyCanvas.manager.layers.toArray();
  }

  /**
   * Renders one frame.
   *
   * Frames are serialized: calling this again before the previous frame has
   * finished queues the new frame rather than drawing over a half-finished one.
   *
   * @param {number} [time] - Timeline position, in seconds.
   */
  public renderFrame(time: number): Promise<void> {
    const next = this.renderQueue.then(
      () => this.drawFrame(time),
      () => this.drawFrame(time),
    );
    // Keep the queue alive after a failed frame, but let the caller see the error.
    this.renderQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async drawFrame(time: number): Promise<void> {
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

  /**
   * Renders the frame at time `0` and returns the canvas.
   *
   * @returns {Promise<ICanvas>} The adapter's canvas.
   */
  public async renderFirstFrame(): Promise<ICanvas> {
    await this.renderFrame(0);
    return this.lazyCanvas.canvas;
  }

  /**
   * Copies the current pixels of the canvas.
   *
   * @returns {Uint8ClampedArray} RGBA data, `width * height * 4` bytes.
   */
  public getImageData(): Uint8ClampedArray {
    const imageData = this.lazyCanvas.ctx.getImageData(0, 0, this.width, this.height);
    return new Uint8ClampedArray(imageData.data);
  }

  /** The canvas width in pixels. */
  public get width(): number {
    return this.lazyCanvas.canvas.width;
  }

  /** The canvas height in pixels. */
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

  /**
   * Renders a range of the timeline and encodes every frame as a PNG.
   *
   * @param {number} startTime - The first time to render, in seconds.
   * @param {number} endTime - The last time to render, in seconds.
   * @param {number} [fps] - Frames per second. Defaults to `30`.
   * @returns {Promise<any[]>} One `Buffer` (Node.js) or data URL (browser) per frame.
   */
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

  /**
   * Renders a range of the timeline and returns the raw pixels of every frame.
   *
   * @param {number} startTime - The first time to render, in seconds.
   * @param {number} endTime - The last time to render, in seconds.
   * @param {number} [fps] - Frames per second. Defaults to `30`.
   * @returns {Promise<Uint8ClampedArray[]>} RGBA data per frame.
   */
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

  /**
   * Finds a layer by id anywhere in the tree.
   *
   * @param {string} id - The layer id.
   * @returns {AnyLayer | Div | undefined} The layer, if it exists.
   */
  public getLayer(id: string): AnyLayer | Div | undefined {
    return this.lazyCanvas.manager.layers.get(id, true);
  }

  /**
   * Starts an animation on the scene timeline.
   *
   * @param {ThreadGenerator | (() => ThreadGenerator)} generatorOrFactory - A generator, or a function returning one.
   */
  public addAnimation(generatorOrFactory: ThreadGenerator | (() => ThreadGenerator)): void {
    const gen =
      typeof generatorOrFactory === "function"
        ? (generatorOrFactory as () => ThreadGenerator)()
        : generatorOrFactory;
    this.scheduler.add(gen);
  }

  /**
   * Starts an animation that drives one signal.
   *
   * @param {Signal<T>} signal - The signal being animated.
   * @param {ThreadGenerator | (() => ThreadGenerator)} generatorOrFactory - A generator, or a function returning one.
   */
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

  /** Stops and removes every running animation. */
  public clearAnimations(): void {
    this.scheduler.clear();
  }

  /** Rewinds the timeline to `0`. Signals keep their current values; reset them with `resetSignals`. */
  public resetTimeline(): void {
    this.scheduler.reset();
    this.lastFrameTime = 0;
  }

  /** Whether any animation is still running. */
  public hasActiveAnimations(): boolean {
    return this.scheduler.hasActiveThreads();
  }
}

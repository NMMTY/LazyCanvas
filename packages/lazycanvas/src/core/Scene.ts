import { Div } from "../structures/components";
import { AnyLayer, Export } from "../types";
import { ThreadScheduler } from "./ThreadScheduler";
import { ThreadGenerator, Signal } from "./Signal";
import { LazyCanvas } from "../structures/LazyCanvas";
import { Canvas } from "@napi-rs/canvas";
import {ModernRenderManager} from "../structures/managers";

/**
 * Scene class - manages canvas, context, layers, and animation timeline
 */
export class Scene {
  public readonly lazyCanvas: LazyCanvas;

  private allLayers: (AnyLayer | Div)[] = [];
  private scheduler: ThreadScheduler = new ThreadScheduler();
  private lastFrameTime = 0;

  /**
   * Create a new Scene
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   * @param opts
   */
  constructor(width: number, height: number, opts: { debug?: boolean } = {}) {
    this.lazyCanvas = new LazyCanvas(ModernRenderManager, opts).create(width, height);
  }

  /**
   * Load a layer tree created via JSX
   * Registers all layers with IDs into the manager
   * @param tree - Root layer or group
   */
  public load(tree: AnyLayer | Div): void {
    this.lazyCanvas.manager.layers.add(tree);
    this.allLayers = this.lazyCanvas.manager.layers.toArray();
  }

  /**
   * Render a single frame at the given time
   * @param time - Time in seconds
   */
  public async renderFrame(time: number): Promise<void> {
    if (this.lazyCanvas.manager.layers.size() === 0) {
      throw new Error("Scene: No root layer loaded. Call scene.load(tree) first.");
    }

    // 1. Update scheduler with current time
    this.scheduler.update(time);

    // 2. Clear canvas
    this.lazyCanvas.ctx.clearRect(
      0,
      0,
      this.lazyCanvas.canvas.width,
      this.lazyCanvas.canvas.height,
    );

    // 3. PHASE 1: Update all layer states from signals
    this.updateAllStates(time);

    // 4. PHASE 2: Draw the layer tree using RenderManager
    await this.lazyCanvas.manager.render.render(Export.CTX);

    this.lastFrameTime = time;
  }

  public async renderFirstFrame(): Promise<Canvas> {
    await this.renderFrame(0);
    return this.lazyCanvas.canvas as Canvas;
  }

  /**
   * Get current frame as ImageData (Uint8ClampedArray)
   * Much faster than encoding to PNG
   */
  public getImageData(): Uint8ClampedArray {
    const imageData = this.lazyCanvas.ctx.getImageData(0, 0, this.width, this.height);
    return imageData.data;
  }

  /**
   * Get canvas width
   */
  public get width(): number {
    return this.lazyCanvas.canvas.width;
  }

  /**
   * Get canvas height
   */
  public get height(): number {
    return this.lazyCanvas.canvas.height;
  }

  /**
   * Update state for all layers that have signals
   * @param time - Current time in seconds
   */
  private updateAllStates(time: number): void {
    for (const layer of this.allLayers) {
      // Check if layer has updateState method (added by BaseLayer)
      if ("updateState" in layer && typeof layer.updateState === "function") {
        layer.updateState(time);
      }
    }
  }

  /**
   * Render multiple frames and return as animation
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @param fps - Frames per second (default: 30)
   * @returns Array of PNG buffers for each frame
   */
  public async renderAnimation(
    startTime: number,
    endTime: number,
    fps: number = 30,
  ): Promise<Buffer[]> {
    const frames: Buffer[] = [];
    const frameDuration = 1 / fps;

    for (let time = startTime; time <= endTime; time += frameDuration) {
      await this.renderFrame(time);
      frames.push(await (this.lazyCanvas.canvas as Canvas).encode("png"));
    }

    return frames;
  }

  /**
   * Render multiple frames and return as ImageData array (much faster)
   * @param startTime - Start time in seconds
   * @param endTime - End time in seconds
   * @param fps - Frames per second (default: 30)
   * @returns Array of Uint8ClampedArray for each frame
   */
  public async renderAnimationData(
    startTime: number,
    endTime: number,
    fps: number = 30,
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
   * Get a layer by ID from the manager
   * @param id - Layer ID
   * @returns Layer or undefined
   */
  public getLayer(id: string): AnyLayer | Div | undefined {
    return this.lazyCanvas.manager.layers.get(id, true);
  }

  /**
   * Add animation generator to scheduler
   * @param generator - Animation generator to run
   */
  public addAnimation(generator: ThreadGenerator): void {
    this.scheduler.add(generator);
  }

  /**
   * Play animation on a signal
   * @param signal - Signal to animate
   * @param generator - Animation generator
   */
  public playAnimation<T>(signal: Signal<T>, generator: ThreadGenerator): void {
    signal.run(generator);
    this.scheduler.add(generator);
  }

  /**
   * Clear all animations
   */
  public clearAnimations(): void {
    this.scheduler.clear();
  }

  /**
   * Reset scene timeline
   */
  public resetTimeline(): void {
    this.scheduler.reset();
    this.lastFrameTime = 0;
  }
}

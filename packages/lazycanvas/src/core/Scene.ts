import { LazyCanvas } from "../structures/LazyCanvas";
import type { Group } from "../structures/components";
import {
  type LayerCacheOptions,
  type LayerCacheStats,
  ModernRenderPipeline,
} from "../structures/managers";
import { type AnyExport, type AnyLayer, Export, type ICanvas, type ICanvasAdapter } from "../types";
import { treeVersion, walkLayers, yieldToEventLoop } from "../utils";
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
 * scene.load(new Morph({ color: "#22c55e", size: { width: 400, height: 200 } }));
 * await scene.renderFrame(0);
 * ```
 */
export class Scene {
  public readonly lazyCanvas: LazyCanvas;

  private allLayers: (AnyLayer | Group)[] = [];
  private scheduler: ThreadScheduler;
  private lastFrameTime = 0;

  /** Signals handed to {@link Scene.playAnimation}; they may not be used by any layer. */
  private playedSignals = new Set<Signal<any>>();

  /** The signals of the layers, found by walking the tree. Walked again only when the tree changes. */
  private signalList: Signal<any>[] = [];
  private signalsOfVersion = -1;
  private signalsOfLayers: unknown;
  private signalsOfScheduler = -1;

  /** Animations added as functions: the only ones whose length can be measured. */
  private factories: Array<() => ThreadGenerator> = [];
  private measuredDuration: number | undefined;

  /**
   * Tail of the render queue. Frames share one canvas context, and layers hold
   * `ctx.save()` across awaits (loading an image, resolving a fill), so two
   * frames running at once interleave their save/restore pairs: one frame's
   * `restore()` pops the other's state and clips and transforms leak between
   * them. Chaining every frame onto this promise keeps them strictly ordered.
   */
  private renderQueue: Promise<void> = Promise.resolve();

  /** Id of the newest {@link Scene.renderLatest | renderLatest} request; older ones are skipped. */
  private latestRequest = 0;

  private readonly onFrameDrawn?: (time: number) => void;

  /**
   * @param {number} width - The canvas width in pixels.
   * @param {number} height - The canvas height in pixels.
   * @param {object} [opts] - Options.
   * @param {ICanvasAdapter} opts.adapter - The canvas adapter for the current environment. Required.
   * @param {boolean} [opts.debug] - Enables verbose logging.
   * @param {(time: number) => void} [opts.onFrameDrawn] - Called after every frame that was drawn
   * completely, before the next queued frame starts. The canvas holds exactly that frame at this
   * point, so it is the place to copy it somewhere (e.g. from an off-screen canvas to a visible one).
   * @param {number} [opts.timeStep] - Length of one simulation step in seconds, `1/240` by default.
   * Animations are advanced in whole steps, so a longer step is cheaper (a frame costs one pass over
   * every running animation per step) and a shorter one follows time more closely. A frame time is
   * rounded down to a step, so `1/60` shows each 60 fps frame exactly, while an export at another
   * rate would show some frames twice.
   * @param {boolean | { maxSeconds?: number, maxEntries?: number }} [opts.history] - Remember the values of
   * animated signals, so `renderFrame` can be asked for an earlier time than the last one (a scrubber, a
   * paused preview). On by default, keeping ten minutes or a million recorded values, whichever is reached
   * first: a scene with thousands of moving signals keeps seconds, a small one keeps all ten minutes.
   * `false` turns it off, which also saves the time spent recording, and going back in time then throws.
   * @param {boolean | LayerCacheOptions} [opts.cache] - Keep the picture of layers between frames and
   * reuse it while nothing that shows in it has changed. For a scene that is drawn again and
   * again (a live preview); a scene drawn once only pays for it. See `LayerCache`.
   * @throws {LazyError} If no adapter is given.
   */
  constructor(
    width: number,
    height: number,
    opts: {
      debug?: boolean;
      adapter?: ICanvasAdapter;
      onFrameDrawn?: (time: number) => void;
      cache?: boolean | LayerCacheOptions;
      history?: boolean | { maxSeconds?: number; maxEntries?: number };
      timeStep?: number;
    } = {},
  ) {
    this.lazyCanvas = new LazyCanvas(ModernRenderPipeline, opts).create(width, height);
    this.scheduler = new ThreadScheduler({ history: opts.history, step: opts.timeStep });
    this.onFrameDrawn = opts.onFrameDrawn;
  }

  /** Counters of the layer cache, or `undefined` if the scene was created without `cache`. */
  public cacheStats(): LayerCacheStats | undefined {
    return this.lazyCanvas.cache?.stats;
  }

  /** Forgets every stored layer picture. The next frame draws everything for real. */
  public clearCache(): void {
    this.lazyCanvas.cache?.clear();
  }

  /**
   * Adds a layer, or a tree of layers under a `Group`, to the scene.
   *
   * Call it once per root layer before rendering.
   *
   * @param {AnyLayer | Group} tree - The root layer.
   */
  public load(tree: AnyLayer | Group): void {
    this.lazyCanvas.manager.layers.add(tree);
    this.allLayers = this.lazyCanvas.manager.layers.toArray();
  }

  /**
   * Renders one frame.
   *
   * `time` can be any moment of the timeline, in any order: frames at `2`, then `0.5`, then
   * `3` show exactly what playing from the start would show at those times. Time moves in
   * steps of `1/240` of a second, so a `time` is rounded down to the step.
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

  /**
   * Renders a frame that replaces the previous ones, for a scene that is redrawn
   * faster than it can be drawn (a colour picker being dragged, a live preview).
   *
   * Frames still run one at a time and a frame that has started is always finished,
   * so something reaches the screen even while requests keep coming. Requests that
   * are waiting behind it are what gets dropped: when the running frame is done,
   * only the newest waiting request is drawn, so a burst of N changes costs one
   * frame in flight plus one more, not N.
   *
   * @param {number} time - Timeline position, in seconds.
   * @param {Array<AnyLayer | Group>} [roots] - Layer trees to show instead of the current
   * ones. They are swapped in right before this frame is drawn, never while another
   * frame is still using the old trees, and not at all if a newer request replaced this one.
   * @returns {Promise<boolean>} `true` if the frame was drawn, `false` if a newer request replaced it.
   */
  public renderLatest(time: number, roots?: Array<AnyLayer | Group>): Promise<boolean> {
    const request = ++this.latestRequest;
    const run = async (): Promise<boolean> => {
      if (request !== this.latestRequest) return false;
      if (roots) {
        this.lazyCanvas.manager.layers.clear();
        for (const root of roots) this.load(root);
      }
      await this.drawFrame(time);
      return true;
    };
    const next = this.renderQueue.then(run, run);
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

    this.watchSignals();
    this.scheduler.update(time);

    // Start every frame from a clean slate: a transform or clip left behind by
    // earlier drawing (a failed frame, or user code) would make this frame come
    // out shifted and clear the wrong area, leaving the old one visible.
    const ctx = this.lazyCanvas.ctx as { resetTransform?: () => void };
    ctx.resetTransform?.();

    this.lazyCanvas.ctx.clearRect(
      0,
      0,
      this.lazyCanvas.canvas.width,
      this.lazyCanvas.canvas.height,
    );

    this.updateAllStates(time);

    await this.lazyCanvas.manager.render.render(Export.CTX);

    this.lastFrameTime = time;
    this.onFrameDrawn?.(time);
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
   * @param {Uint8ClampedArray} [into] - A buffer of `width * height * 4` bytes to copy the pixels into,
   * instead of allocating a new one for every call.
   * @returns {Uint8ClampedArray} RGBA data, `width * height * 4` bytes.
   */
  public getImageData(into?: Uint8ClampedArray): Uint8ClampedArray {
    const imageData = this.lazyCanvas.ctx.getImageData(0, 0, this.width, this.height);
    if (into) {
      if (into.length !== imageData.data.length) {
        throw new Error(
          `getImageData: the buffer holds ${into.length} bytes but a frame is ${imageData.data.length}`,
        );
      }
      into.set(imageData.data);
      return into;
    }
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

  /** Tells the scheduler which signals to remember, so the timeline can go back. */
  private watchSignals(): void {
    if (
      this.signalsOfVersion === treeVersion() &&
      this.signalsOfLayers === this.allLayers &&
      this.signalsOfScheduler === this.scheduler.generation
    ) {
      return;
    }

    const found = new Set<Signal<any>>(this.playedSignals);
    for (const layer of walkLayers(this.allLayers)) {
      const signals = (layer as { listSignals?: () => Signal<any>[] }).listSignals?.();
      if (signals) for (const signal of signals) found.add(signal);
    }
    this.signalList = [...found];
    for (const signal of this.signalList) this.scheduler.watch(signal);

    this.signalsOfVersion = treeVersion();
    this.signalsOfLayers = this.allLayers;
    this.signalsOfScheduler = this.scheduler.generation;
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
   * Renders a range of the timeline one frame at a time, handing each frame over as soon as it is drawn.
   *
   * Nothing is kept: an export of any length takes the memory of one frame. Use it instead of
   * {@link Scene.renderAnimationData} when the frames are written or encoded as they come.
   *
   * Between frames the event loop gets to run, which is what lets Node release the memory behind each
   * read-back; a loop that only awaits promises would not.
   *
   * @param {number} startTime - The first time to render, in seconds.
   * @param {number} endTime - The last time to render, in seconds.
   * @param {number} [fps] - Frames per second. Defaults to `30`.
   * @param {{ reuse?: boolean }} [options] - With `reuse`, every frame is written into the same buffer, so
   * a frame is only valid until the next one is asked for: copy or encode it before the loop continues.
   * @yields {{ index: number, time: number, data: Uint8ClampedArray }} RGBA data, `width * height * 4` bytes.
   *
   * @example
   * ```ts
   * for await (const { data } of scene.frames(0, 5, 30, { reuse: true })) encoder.addFrame(data);
   * ```
   */
  public async *frames(
    startTime: number,
    endTime: number,
    fps = 30,
    options: { reuse?: boolean } = {},
  ): AsyncGenerator<{ index: number; time: number; data: Uint8ClampedArray }, void, undefined> {
    // Counting frames, not adding 1/fps to a time: the sum drifts and can lose the last frame.
    const count = Math.max(0, Math.floor((endTime - startTime) * fps + 1e-6) + 1);
    const buffer = options.reuse ? new Uint8ClampedArray(this.width * this.height * 4) : undefined;

    for (let index = 0; index < count; index++) {
      const time = startTime + index / fps;
      await this.renderFrame(time);
      yield { index, time, data: this.getImageData(buffer) };
      await yieldToEventLoop();
    }
  }

  /**
   * Renders a range of the timeline and encodes every frame as a PNG.
   *
   * All the frames are kept until the method returns; for a long range use {@link Scene.frames}.
   *
   * @param {number} startTime - The first time to render, in seconds.
   * @param {number} endTime - The last time to render, in seconds.
   * @param {number} [fps] - Frames per second. Defaults to `30`.
   * @returns {Promise<any[]>} One `Buffer` (Node.js) or data URL (browser) per frame.
   */
  public async renderAnimation(startTime: number, endTime: number, fps = 30): Promise<any[]> {
    const frames: any[] = [];
    const count = Math.max(0, Math.floor((endTime - startTime) * fps + 1e-6) + 1);

    for (let index = 0; index < count; index++) {
      await this.renderFrame(startTime + index / fps);
      const canvas = this.lazyCanvas.canvas;
      if ("toBuffer" in canvas && typeof canvas.toBuffer === "function") {
        frames.push(canvas.toBuffer("image/png"));
      } else if ("toDataURL" in canvas && typeof canvas.toDataURL === "function") {
        frames.push(canvas.toDataURL("image/png"));
      }
      await yieldToEventLoop();
    }

    return frames;
  }

  /**
   * Renders a range of the timeline and returns the raw pixels of every frame.
   *
   * All the frames are kept until the method returns: 3.7 MB each at 1280 × 720, so a minute at 60 fps
   * is over 13 GB. For anything long use {@link Scene.frames}, which keeps one frame at a time.
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
    for await (const frame of this.frames(startTime, endTime, fps)) frames.push(frame.data);
    return frames;
  }

  /**
   * Finds a layer by id anywhere in the tree.
   *
   * @param {string} id - The layer id.
   * @returns {AnyLayer | Group | undefined} The layer, if it exists.
   */
  public getLayer(id: string): AnyLayer | Group | undefined {
    return this.lazyCanvas.manager.layers.get(id, true);
  }

  /**
   * The layers under a point of the canvas, the top-most first.
   *
   * A layer counts if the point is inside its box after every transform (a rotated layer is hit
   * where it is). Layers that are hidden or have not been drawn yet are skipped. Positions are
   * those of the last frame that was drawn.
   *
   * @param {{ x: number, y: number }} point - A point of the canvas, in pixels.
   * @returns {Array<AnyLayer | Group>} The layers at the point.
   */
  public layersAt(point: { x: number; y: number }): Array<AnyLayer | Group> {
    const hits: Array<AnyLayer | Group> = [];
    for (const layer of walkLayers(this.allLayers)) {
      const candidate = layer as AnyLayer | Group;
      if (!candidate.visible || !candidate.isDrawn()) continue;
      if (candidate.contains(point)) hits.push(candidate);
    }
    return hits.reverse();
  }

  /**
   * The top-most layer under a point of the canvas, if any.
   *
   * @param {{ x: number, y: number }} point - A point of the canvas, in pixels.
   * @returns {AnyLayer | Group | undefined} The layer, if the point is on one.
   */
  public layerAt(point: { x: number; y: number }): AnyLayer | Group | undefined {
    return this.layersAt(point)[0];
  }

  /**
   * Starts an animation on the scene timeline.
   *
   * @param {ThreadGenerator | (() => ThreadGenerator)} generatorOrFactory - A generator, or a function returning one.
   */
  public addAnimation(generatorOrFactory: ThreadGenerator | (() => ThreadGenerator)): void {
    const gen = this.start(generatorOrFactory);
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
    this.playedSignals.add(signal);
    this.signalsOfVersion = -1;
    const gen = this.start(generatorOrFactory);
    signal.run(gen);
    this.scheduler.add(gen);
  }

  /** Creates the generator for an animation and remembers a factory so its length can be measured. */
  private start(generatorOrFactory: ThreadGenerator | (() => ThreadGenerator)): ThreadGenerator {
    this.measuredDuration = undefined;
    if (typeof generatorOrFactory === "function") {
      this.factories.push(generatorOrFactory);
      return generatorOrFactory();
    }
    return generatorOrFactory;
  }

  /** Stops and removes every running animation. */
  public clearAnimations(): void {
    this.scheduler.clear();
    this.factories = [];
    this.measuredDuration = undefined;
  }

  /** Rewinds the timeline to `0`. Signals keep their current values; reset them with `resetSignals`. */
  public resetTimeline(): void {
    this.scheduler.reset();
    this.lastFrameTime = 0;
  }

  /**
   * Length of the animations in seconds: how long until all of them have finished.
   *
   * Only animations added as a function (`scene.addAnimation(() => move())`) are counted.
   * A generator that was already created cannot be run a second time to find out how long it
   * is, so it is left out; `0` means no measurable animation.
   *
   * Measuring runs the animations on a copy of the clock and puts the signals back afterwards,
   * so unlike `calculateDuration` it does not leave them at their end values.
   */
  public get duration(): number {
    if (this.measuredDuration === undefined) {
      this.measuredDuration = this.measureDuration();
    }
    return this.measuredDuration;
  }

  private measureDuration(maxSeconds = 3600): number {
    if (this.factories.length === 0) return 0;

    this.watchSignals();
    const signals = this.signalList;
    const saved = signals.map((signal) => [signal, signal.value()] as const);

    const sandbox = new ThreadScheduler({ step: this.scheduler.step, history: false });
    for (const factory of this.factories) sandbox.add(factory());

    let steps = 0;
    const maxSteps = Math.ceil(maxSeconds / sandbox.step);
    try {
      sandbox.update(0);
      while (sandbox.hasActiveThreads() && steps < maxSteps) {
        steps++;
        sandbox.update(steps * sandbox.step);
      }
    } finally {
      for (const [signal, value] of saved) signal.restore(value);
    }

    return Math.round(steps * sandbox.step * 1e9) / 1e9;
  }

  /** Whether any animation is still running. */
  public hasActiveAnimations(): boolean {
    return this.scheduler.hasActiveThreads();
  }
}

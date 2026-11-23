import { type AnyExport, Export, type JSONLayer } from "../types";
import type { ICanvas, ICanvasAdapter, ICanvasRenderingContext2D } from "../types";
import { LazyError, LazyLog, registerPath2D, resize, resizeLayers } from "../utils";
import type { IGroup } from "./components";
import {
  type BakeOptions,
  Baker,
  ClassicRenderPipeline,
  FontsManager,
  type IRenderManager,
  LayerCache,
  type LayerCacheOptions,
  LayersManager,
  type RenderManagerConstructor,
} from "./managers";
import { LayoutManager } from "./managers/LayoutManager";

/**
 * Interface representing the LazyCanvas structure.
 */
export interface ILazyCanvas {
  canvas: ICanvas;
  ctx: ICanvasRenderingContext2D;
  adapter: ICanvasAdapter;
  manager: {
    layers: LayersManager;
    render: IRenderManager;
    fonts: FontsManager;
    layout: LayoutManager;
  };
  options: ILazyCanvasOptions;
}

/**
 * Interface representing the options for LazyCanvas.
 */
export interface ILazyCanvasOptions {
  width: number;
  height: number;
  animated: boolean;
  exportType: AnyExport;
}

/**
 * Interface representing the input options for LazyCanvas.
 */
export interface IOLazyCanvas {
  options: ILazyCanvasOptions;
  layers: Array<JSONLayer | IGroup>;
}

/**
 * Class representing a LazyCanvas, which provides a structured way to manage canvas rendering.
 */
export class LazyCanvas implements ILazyCanvas {
  canvas: ICanvas;
  ctx: ICanvasRenderingContext2D;
  adapter: ICanvasAdapter;
  manager: {
    layers: LayersManager;
    render: IRenderManager;
    fonts: FontsManager;
    layout: LayoutManager;
  };
  options: ILazyCanvasOptions;

  /** Remembers layers between frames; `undefined` unless the canvas was created with `cache`. */
  cache?: LayerCache;

  /** Draws what stays the same from frame to frame as one picture; `undefined` unless created with `bake`. */
  baker?: Baker;

  constructor(
    renderPipline: RenderManagerConstructor = ClassicRenderPipeline,
    opts?: {
      debug?: boolean;
      settings?: IOLazyCanvas;
      adapter?: ICanvasAdapter;
      cache?: boolean | LayerCacheOptions;
      bake?: boolean | BakeOptions;
    },
  ) {
    if (!opts?.adapter) {
      throw new LazyError(
        "A canvas adapter is required. Install and pass one, e.g.:\n" +
          '  import { NodeCanvasAdapter } from "@nmmty/adapter-node";\n' +
          "  new LazyCanvas(ClassicRenderPipeline, { adapter: new NodeCanvasAdapter() })",
      );
    }
    this.adapter = opts.adapter;
    // Make the adapter's Path2D reachable from layers created without one.
    registerPath2D(this.adapter.Path2D);
    this.canvas = this.adapter.createCanvas(0, 0);
    this.ctx = this.canvas.getContext("2d");
    this.manager = {
      layers: new LayersManager({ debug: opts?.debug, adapter: opts?.adapter }),
      render: new renderPipline(this, { debug: opts?.debug }),
      fonts: new FontsManager({ debug: opts?.debug, adapter: opts?.adapter }),
      layout: new LayoutManager({ debug: opts?.debug }),
    };
    if (opts.cache) {
      this.cache = new LayerCache(this.adapter, typeof opts.cache === "object" ? opts.cache : {});
      this.manager.layers.cache = this.cache;
    }
    if (opts.bake) {
      this.baker = new Baker(this.adapter, typeof opts.bake === "object" ? opts.bake : {});
      this.manager.layers.baker = this.baker;
    }
    // What a layer looks like depends on the fonts it is drawn with, which its props do not say.
    this.manager.fonts.onChange = () => {
      this.cache?.clear();
      this.baker?.clear();
    };
    this.options = {
      width: 0,
      height: 0,
      animated: false,
      exportType: Export.BUFFER,
      ...opts?.settings?.options,
    };

    if (opts?.debug) LazyLog.log("info", "LazyCanvas initialized with settings:", opts.settings);
  }

  /**
   * Sets the export type and recreates the underlying canvas.
   *
   * @param {AnyExport} type - The target format.
   * @returns {this} The current instance for chaining.
   */
  public setExportType(type: AnyExport): this {
    this.options.exportType = type;
    this.canvas = this.adapter.createCanvas(this.options.width, this.options.height);
    this.ctx = this.canvas.getContext("2d");
    this.cache?.clear();
    this.baker?.clear();
    return this;
  }

  /**
   * Marks the canvas as animated.
   *
   * @returns {this} The current instance for chaining.
   */
  animated(): this {
    this.options.animated = true;
    return this;
  }

  /**
   * Scales the canvas and every layer on it by `ratio`.
   *
   * @param {number} ratio - The scale factor, e.g. `2` doubles the size.
   * @returns {this} The current instance for chaining.
   * @throws {Error} If the canvas dimensions are not set yet.
   */
  resize(ratio: number): this {
    if (this.options.width <= 0 || this.options.height <= 0) {
      throw new Error("Canvas dimensions are not set.");
    }
    this.options.width = resize(this.options.width, ratio) as number;
    this.options.height = resize(this.options.height, ratio) as number;
    this.canvas = this.adapter.createCanvas(this.options.width, this.options.height);
    this.ctx = this.canvas.getContext("2d");
    this.cache?.clear();
    this.baker?.clear();
    const layers = resizeLayers(this.manager.layers.toArray(), ratio);
    this.manager.layers.fromArray(layers);
    return this;
  }

  /**
   * Creates the canvas through the adapter and clears the layer tree.
   *
   * @param {number} width - The canvas width in pixels.
   * @param {number} height - The canvas height in pixels.
   * @returns {this} The current instance for chaining.
   */
  create(width: number, height: number): this {
    this.options.width = width;
    this.options.height = height;
    this.canvas = this.adapter.createCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
    this.manager.layers = new LayersManager({
      debug: this.manager.layers.debug,
      adapter: this.adapter,
    });
    this.manager.layers.cache = this.cache;
    this.manager.layers.baker = this.baker;
    this.cache?.clear();
    this.baker?.clear();
    return this;
  }
}

import { Export, AnyExport, JSONLayer } from "../types";
import { ICanvas, ICanvasRenderingContext2D, ICanvasAdapter } from "../types";
import {
  LayersManager,
  IRenderManager,
  FontsManager,
  RenderManagerConstructor,
  ClassicRenderPipeline,
} from "./managers";
import { LayoutManager } from "./managers/LayoutManager";
import { IDiv } from "./components";
import { LazyError, LazyLog, registerPath2D, resizeLayers, resize } from "../utils";

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
  layers: Array<JSONLayer | IDiv>;
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

  constructor(
    renderPipline: RenderManagerConstructor = ClassicRenderPipeline,
    opts?: { debug?: boolean; settings?: IOLazyCanvas; adapter?: ICanvasAdapter },
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
      layers: new LayersManager({ debug: opts?.debug }),
      render: new renderPipline(this, { debug: opts?.debug }),
      fonts: new FontsManager({ debug: opts?.debug, adapter: opts?.adapter }),
      layout: new LayoutManager({ debug: opts?.debug }),
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

  public setExportType(type: AnyExport): this {
    this.options.exportType = type;
    this.canvas = this.adapter.createCanvas(this.options.width, this.options.height);
    this.ctx = this.canvas.getContext("2d");
    return this;
  }

  animated(): this {
    this.options.animated = true;
    return this;
  }

  resize(ratio: number): this {
    if (this.options.width <= 0 || this.options.height <= 0) {
      throw new Error("Canvas dimensions are not set.");
    }
    this.options.width = resize(this.options.width, ratio) as number;
    this.options.height = resize(this.options.height, ratio) as number;
    this.canvas = this.adapter.createCanvas(this.options.width, this.options.height);
    this.ctx = this.canvas.getContext("2d");
    const layers = resizeLayers(this.manager.layers.toArray(), ratio);
    this.manager.layers.fromArray(layers);
    return this;
  }

  create(width: number, height: number): this {
    this.options.width = width;
    this.options.height = height;
    this.canvas = this.adapter.createCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
    this.manager.layers = new LayersManager({ debug: this.manager.layers.debug });
    return this;
  }
}

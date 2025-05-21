import {Export, AnyExport, JSONLayer, ScaleType} from "../types";
import { Canvas, SKRSContext2D, SvgCanvas, SvgExportFlag } from "@napi-rs/canvas";
import { LayersManager } from "./managers/LayersManager";
import { RenderManager } from "./managers/RenderManager";
import { FontsManager } from "./managers/FontsManager";
import { AnimationManager, IAnimationOptions } from "./managers/AnimationManager";
import { Group } from "./components";
import { LazyLog } from "../utils/LazyUtil";
import { resizeLayers, resize } from "../utils/utils";

/**
 * Interface representing the LazyCanvas structure.
 */
export interface ILazyCanvas {
    /**
     * The canvas instance, which can be either a Canvas or SvgCanvas.
     */
    canvas: Canvas | SvgCanvas;

    /**
     * The 2D rendering context of the canvas.
     */
    ctx: SKRSContext2D;

    /**
     * The manager object containing various managers for layers, rendering, fonts, and animation.
     */
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
    };

    /**
     * The options for configuring the LazyCanvas instance.
     */
    options: ILazyCanvasOptions;
}

/**
 * Interface representing the options for LazyCanvas.
 */
export interface ILazyCanvasOptions {
    /**
     * The width of the canvas.
     */
    width: number;

    /**
     * The height of the canvas.
     */
    height: number;

    /**
     * Whether the canvas is animated.
     */
    animated: boolean;

    /**
     * The export type for the canvas (e.g., buffer, SVG, etc.).
     */
    exportType: AnyExport;

    /**
     * The SVG export flag for encoding paths.
     */
    flag: SvgExportFlag;
}

/**
 * Interface representing the input options for LazyCanvas.
 */
export interface IOLazyCanvas {
    /**
     * The options for configuring the LazyCanvas instance.
     */
    options: ILazyCanvasOptions;

    /**
     * The animation options for the LazyCanvas instance.
     */
    animation: IAnimationOptions;

    /**
     * The layers to be added to the LazyCanvas instance.
     */
    layers: Array<JSONLayer | Group>;
}

/**
 * Class representing a LazyCanvas, which provides a structured way to manage canvas rendering.
 */
export class LazyCanvas implements ILazyCanvas {
    /**
     * The canvas instance, which can be either a Canvas or SvgCanvas.
     */
    canvas: Canvas | SvgCanvas;

    /**
     * The 2D rendering context of the canvas.
     */
    ctx: SKRSContext2D;

    /**
     * The manager object containing various managers for layers, rendering, fonts, and animation.
     */
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
    };

    /**
     * The options for configuring the LazyCanvas instance.
     */
    options: ILazyCanvasOptions;

    /**
     * Constructs a new LazyCanvas instance.
     * @param opts {Object} - Optional settings for the LazyCanvas instance.
     * @param opts.debug {boolean} - Whether debugging is enabled.
     * @param opts.settings {IOLazyCanvas} - The input settings for the LazyCanvas instance.
     */
    constructor(opts?: { debug?: boolean, settings?: IOLazyCanvas }) {
        this.canvas = new Canvas(0, 0);
        this.ctx = this.canvas.getContext('2d');
        this.manager = {
            layers: new LayersManager({ debug: opts?.debug }),
            render: new RenderManager(this, { debug: opts?.debug }),
            fonts: new FontsManager({ debug: opts?.debug }),
            animation: new AnimationManager({ debug: opts?.debug, settings: { options: opts?.settings?.animation } })
        };
        this.options = {
            width: opts?.settings?.options.width || 0,
            height: opts?.settings?.options.height || 0,
            animated: opts?.settings?.options.animated || false,
            exportType: opts?.settings?.options.exportType || Export.BUFFER,
            flag: opts?.settings?.options.flag || SvgExportFlag.RelativePathEncoding
        };

        if (opts?.debug) LazyLog.log('info', 'LazyCanvas initialized with settings:', opts.settings);
    }

    /**
     * Sets the export type for the canvas.
     * @param type {AnyExport} - The export type (e.g., buffer, SVG, etc.).
     * @returns {this} The current instance for chaining.
     */
    public setExportType(type: AnyExport): this {
        this.options.exportType = type;
        switch (type) {
            case Export.BUFFER:
                this.canvas = new Canvas(this.options.width, this.options.height);
                this.ctx = this.canvas.getContext('2d');
                break;
            case Export.CTX:
                break;
            case Export.SVG:
                this.canvas = new Canvas(this.options.width, this.options.height, this.options.flag || SvgExportFlag.RelativePathEncoding);
                this.ctx = this.canvas.getContext('2d');
                break;
        }
        return this;
    }

    /**
     * Sets the SVG export flag. This method should be called after `setExportType`.
     * @param flag {SvgExportFlag} - The SVG export flag.
     * @returns {this} The current instance for chaining.
     */
    setSvgExportFlag(flag: SvgExportFlag): this {
        if (this.options.exportType === Export.SVG) {
            this.canvas = new Canvas(this.options.width, this.options.height, flag);
            this.ctx = this.canvas.getContext('2d');
            this.options.flag = flag;
        }
        return this;
    }

    /**
     * Enables animation for the canvas.
     * @returns {this} The current instance for chaining.
     */
    animated(): this {
        this.options.animated = true;
        return this;
    }

    /**
     * Resizes the canvas to the specified dimensions.
     * @param ratio {number} - The ratio to resize the canvas.
     * @returns {this} The current instance for chaining.
     */
    resize(ratio: number): this {
        if (this.options.width <= 0 || this.options.height <= 0) {
            throw new Error('Canvas dimensions are not set.');
        }
        this.options.width = resize(this.options.width, ratio) as number;
        this.options.height = resize(this.options.height, ratio) as number;
        if (this.options.exportType === Export.SVG) {
            this.canvas = new Canvas(this.options.width, this.options.height, this.options.flag || SvgExportFlag.RelativePathEncoding);
        } else {
            this.canvas = new Canvas(this.options.width, this.options.height);
        }
        this.ctx = this.canvas.getContext('2d');
        const layers = resizeLayers(this.manager.layers.toArray(), ratio);
        this.manager.layers.fromArray(layers)
        return this;
    }

    /**
     * Creates a new canvas with the specified dimensions.
     * @param width {number} - The width of the canvas.
     * @param height {number} - The height of the canvas.
     * @returns {this} The current instance for chaining.
     */
    create(width: number, height: number): this {
        this.options.width = width;
        this.options.height = height;
        if (this.options.exportType === Export.SVG) {
            this.canvas = new Canvas(width, height, this.options.flag || SvgExportFlag.RelativePathEncoding);
        } else {
            this.canvas = new Canvas(width, height);
        }
        this.ctx = this.canvas.getContext('2d');
        this.manager.layers = new LayersManager();
        return this;
    }
}
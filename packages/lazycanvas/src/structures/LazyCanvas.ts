import { Export, AnyExport, JSONLayer } from "../types";
import { Canvas, SKRSContext2D, SvgCanvas, SvgExportFlag } from "@napi-rs/canvas";
import { LayersManager, RenderManager, FontsManager, AnimationManager, IAnimationOptions, PluginManager, ILazyCanvasPlugin } from "./managers";
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
     * The manager object containing various managers for layers, rendering, fonts, animation, and plugins.
     */
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
        plugins: PluginManager;
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
     * The manager object containing various managers for layers, rendering, fonts, animation, and plugins.
     */
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
        plugins: PluginManager;
    };

    /**
     * The options for configuring the LazyCanvas instance.
     */
    options: ILazyCanvasOptions;

    /**
     * Constructs a new LazyCanvas instance.
     * @param {Object} [opts] - Optional settings for the LazyCanvas instance.
     * @param {boolean} [opts.debug] - Whether debugging is enabled.
     * @param {IOLazyCanvas} [opts.settings] - The input settings for the LazyCanvas instance.
     */
    constructor(opts?: { debug?: boolean, settings?: IOLazyCanvas }) {
        this.canvas = new Canvas(0, 0);
        this.ctx = this.canvas.getContext('2d');
        this.manager = {
            layers: new LayersManager(this, { debug: opts?.debug }),
            render: new RenderManager(this, { debug: opts?.debug }),
            fonts: new FontsManager({ debug: opts?.debug }),
            animation: new AnimationManager({ debug: opts?.debug, settings: { options: opts?.settings?.animation } }),
            plugins: new PluginManager(this, { debug: opts?.debug })
        };
        this.options = {
            width: 0,
            height: 0,
            animated: false,
            exportType: Export.BUFFER,
            flag: SvgExportFlag.RelativePathEncoding,
            ...opts?.settings?.options
        };

        if (opts?.debug) LazyLog.log('info', 'LazyCanvas initialized with settings:', opts.settings);
    }

    /**
     * Sets the export type for the canvas.
     * @param {AnyExport} [type] - The export type (e.g., buffer, SVG, etc.).
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
     * @param {SvgExportFlag} [flag] - The SVG export flag.
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
     * @param {number} [ratio] - The ratio to resize the canvas.
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
        this.manager.layers.fromArray(layers);

        // Выполняем хук onResize для всех плагинов
        this.manager.plugins.executeHook('onResize', this, ratio);

        return this;
    }

    /**
     * Creates a new canvas with the specified dimensions.
     * @param {number} [width] - The width of the canvas.
     * @param {number} [height] - The height of the canvas.
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
        this.manager.layers = new LayersManager(this, { debug: this.manager.layers.debug });

        // Выполняем хук onCanvasCreated для всех плагинов
        this.manager.plugins.executeHook('onCanvasCreated', this, width, height);

        return this;
    }

    /**
     * Installs a plugin to the canvas.
     * @param {ILazyCanvasPlugin} [plugin] - The plugin to install.
     * @returns {this} The current instance for chaining.
     */
    use(plugin: ILazyCanvasPlugin): this {
        this.manager.plugins.register(plugin);
        return this;
    }

    /**
     * Removes a plugin from the canvas.
     * @param {string} [pluginName] - The name of the plugin to remove.
     * @returns {this} The current instance for chaining.
     */
    removePlugin(pluginName: string): this {
        this.manager.plugins.unregister(pluginName);
        return this;
    }

    /**
     * Gets a plugin by name.
     * @param {string} [pluginName] - The name of the plugin.
     * @returns {ILazyCanvasPlugin | undefined} The plugin or undefined if not found.
     */
    getPlugin(pluginName: string): ILazyCanvasPlugin | undefined {
        return this.manager.plugins.get(pluginName);
    }

    /**
     * Lists all installed plugins.
     * @returns {string[]} Array of plugin names.
     */
    listPlugins(): string[] {
        return this.manager.plugins.list();
    }

    /**
     * Gets information about all installed plugins.
     * @returns Array of plugin information objects.
     */
    getPluginsInfo(): Array<{ name: string; version: string; description?: string; dependencies?: string[] }> {
        return this.manager.plugins.getPluginInfo();
    }
}
import { Export, AnyExport, JSONLayer } from "../types";
import { Canvas, SKRSContext2D, SvgCanvas, SvgExportFlag } from "@napi-rs/canvas";
import { LayersManager } from "./managers/LayersManager";
import { RenderManager } from "./managers/RenderManager";
import { FontsManager } from "./managers/FontsManager";
import { AnimationManager, IAnimationOptions } from "./managers/AnimationManager";
import { Group } from "./components";
import {LazyLog} from "../utils/LazyUtil";

export interface ILazyCanvas {
    canvas: Canvas | SvgCanvas;
    ctx: SKRSContext2D;
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
    };
    options: ILazyCanvasOptions;
}

export interface ILazyCanvasOptions {
    width: number;
    height: number;
    animated: boolean;
    exportType: AnyExport;
    flag: SvgExportFlag;
}

export interface IOLazyCanvas {
    options: ILazyCanvasOptions;
    animation: IAnimationOptions;
    layers: Array<JSONLayer | Group>;
}

export class LazyCanvas implements ILazyCanvas {
    canvas: Canvas | SvgCanvas;
    ctx: SKRSContext2D;
    manager: {
        layers: LayersManager;
        render: RenderManager;
        fonts: FontsManager;
        animation: AnimationManager;
    };
    options: ILazyCanvasOptions;

    constructor(opts?: { debug?: boolean, settings?: IOLazyCanvas }) {
        this.canvas = new Canvas(0, 0);
        this.ctx = this.canvas.getContext('2d');
        this.manager = {
            layers: new LayersManager({ debug: opts?.debug }),
            render: new RenderManager(this, { debug: opts?.debug }),
            fonts: new FontsManager({ debug: opts?.debug }),
            animation: new AnimationManager({ debug: opts?.debug, settings: { options: opts?.settings?.animation } })
        }
        this.options = {
            width: opts?.settings?.options.width || 0,
            height: opts?.settings?.options.height || 0,
            animated: opts?.settings?.options.animated || false,
            exportType: opts?.settings?.options.exportType || Export.BUFFER,
            flag: opts?.settings?.options.flag || SvgExportFlag.RelativePathEncoding
        }

        if (opts?.debug) LazyLog.log('info', 'LazyCanvas initialized with settings:', opts.settings);
    }

    /**
     * Set the export type
     * @param type {AnyExport} - The `export` type
     */
    public setExportType(type: AnyExport) {
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
     * Set the SVG export flag. This method should be called after `setExportType` method.
     * @param flag {SvgExportFlag} - The `flag` of the SVG export
     */
    setSvgExportFlag(flag: SvgExportFlag) {
        if (this.options.exportType === Export.SVG) {
            this.canvas = new Canvas(this.options.width, this.options.height, flag);
            this.ctx = this.canvas.getContext('2d');
            this.options.flag = flag;
        }
        return this
    }

    animated() {
        this.options.animated = true;
        return this;
    }

    /**
     * Create a new canvas. This method should be called before any other methods.
     * @param width {number} - The `width` of the canvas
     * @param height {number} - The `height` of the canvas
     */
    create(width: number, height: number) {
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

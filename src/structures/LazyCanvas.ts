import { Export } from "../types/enum";
import { AnyExport, ILazyCanvas } from "../types";
import { Canvas, SKRSContext2D, SvgExportFlag } from "@napi-rs/canvas";
import { LayersManager } from "./managers/LayersManager";
import { RenderManager } from "./managers/RenderManager";
import { FontsManager } from "./managers/FontsManager";
import { AnimationManager } from "./managers/AnimationManager";

export class LazyCanvas implements ILazyCanvas {
    width: number | 0;
    height: number | 0;
    canvas: Canvas;
    ctx: SKRSContext2D;
    layers: LayersManager;
    render: RenderManager;
    fonts: FontsManager;
    animation: AnimationManager;
    exportType: AnyExport;

    constructor(debug: boolean = false) {
        this.width = 0;
        this.height = 0;
        this.canvas = new Canvas(0, 0);
        this.ctx = this.canvas.getContext('2d');
        this.layers = new LayersManager(debug);
        this.render = new RenderManager(this, debug);
        this.fonts = new FontsManager(debug);
        this.animation = new AnimationManager(debug);
        this.exportType = Export.Buffer;
    }

    /**
     * Set the export type
     * @param type {AnyExport} - The `export` type
     */
    public setExportType(type: AnyExport) {
        this.exportType = type;
        switch (type) {
            case Export.Buffer:
                this.canvas = new Canvas(this.width, this.height);
                this.ctx = this.canvas.getContext('2d');
                break;
            case Export.CTX:
                break;
            case Export.SVG:
                this.canvas = new Canvas(this.width, this.height, SvgExportFlag.RelativePathEncoding);
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
        if (this.exportType === Export.SVG) {
            this.canvas = new Canvas(this.width, this.height, flag);
            this.ctx = this.canvas.getContext('2d');
        }
        return this
    }

    /**
     * Create a new canvas. This method should be called before any other methods.
     * @param width {number} - The `width` of the canvas
     * @param height {number} - The `height` of the canvas
     */
    create(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas = new Canvas(width, height);
        this.ctx = this.canvas.getContext('2d');
        this.layers = new LayersManager();
        return this;
    }
}

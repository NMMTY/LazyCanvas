import { Export } from "../../types/enum";
import { IRenderManager } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { SKRSContext2D } from "@napi-rs/canvas";
import { Group } from "../components/Group";
import { LazyLog } from "../../utils/LazyUtil";

export class RenderManager implements IRenderManager {
    lazyCanvas: LazyCanvas;
    debug: boolean;

    constructor(lazyCanvas: LazyCanvas, debug: boolean = false) {
        this.lazyCanvas = lazyCanvas;
        this.debug = debug;
    }

    /**
     * This will render all the layers and return the rendered canvas buffer or ctx.
     * @returns {Promise<Buffer | SKRSContext2D>}
     */
    public async render(): Promise<Buffer | SKRSContext2D> {
        for (const layer of this.lazyCanvas.layers.toArray()) {
            if (this.debug) LazyLog.log('info', `Rendering ${layer.id}...\nData:`, layer.toJSON());
            if (layer.visible) {
                if (layer instanceof Group) {
                    for (const subLayer of layer.components) {
                        if (subLayer.visible) {
                            await subLayer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.layers, this.debug);
                        }
                    }
                } else {
                    await layer.draw(this.lazyCanvas.ctx, this.lazyCanvas.canvas, this.lazyCanvas.layers, this.debug);
                }
                this.lazyCanvas.ctx.shadowColor = 'transparent';
            }
        }

        switch (this.lazyCanvas.exportType) {
            case Export.Buffer:
            case "buffer":
                return this.lazyCanvas.canvas.toBuffer('image/png');
            case Export.CTX:
            case "ctx":
                return this.lazyCanvas.ctx;
            case Export.SVG:
            case "svg":
                // @ts-ignore
                return this.lazyCanvas.canvas.getContent().toString('utf8');
            default:
                return this.lazyCanvas.canvas.toBuffer('image/png');
        }
    }
}

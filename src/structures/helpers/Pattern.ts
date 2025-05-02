import { FillType, PatternType } from "../../types";
import { AnyPatternType } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { Canvas, loadImage, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Exporter } from "./Exporter";

export interface IPattern {
    fillType: FillType;
    type: AnyPatternType;
    src: string | LazyCanvas;
}

export class Pattern implements IPattern {
    fillType: FillType = FillType.Pattern;
    type: AnyPatternType;
    src: string | LazyCanvas;

    constructor(opts?: { props?: IPattern }) {
        this.type = opts?.props?.type || PatternType.Repeat;
        this.src = opts?.props?.src || '';
    }

    /**
     * Set the type of the pattern
     * @param type {AnyPatternType} - The `type` of the pattern
     */
    setType(type: AnyPatternType) {
        this.type = type;
        return this;
    }

    /**
     * Set the source of the pattern
     * @param src {string | LazyCanvas} - The `src` of the pattern
     */
    setSrc(src: string | LazyCanvas) {
        this.src = src;
        return this;
    }

    async draw(ctx: SKRSContext2D) {
        if (this.src instanceof LazyCanvas) {
            return ctx.createPattern((await this.src.manager.render.render('canvas')) as unknown as Canvas | SvgCanvas, this.type);
        } else {
            return ctx.createPattern(await loadImage(this.src), this.type);
        }
    }

    /**
     * @returns {IPattern}
     */
    toJSON(): IPattern {
        let src = this.src;
        if (this.src instanceof LazyCanvas) {
            // @ts-ignore
            src = new Exporter(this.src).syncExport('json');
        }
        return {
            fillType: this.fillType,
            type: this.type,
            src: src
        }
    }
}

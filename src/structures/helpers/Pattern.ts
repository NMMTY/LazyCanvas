import { PatternType } from "../../types/enum";
import { IPattern, AnyPatternType } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { loadImage, SKRSContext2D } from "@napi-rs/canvas";
import * as jimp from "jimp";

export class Pattern implements IPattern {
    type: AnyPatternType;
    src: string | LazyCanvas;

    constructor() {
        this.type = PatternType.Repeat;
        this.src = '';
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
            let jmp = await this.src.render.render() as Buffer;
            let image = await loadImage(jmp);
            return ctx.createPattern(image, this.type);
        } else {
            let jmp = await jimp.read(this.src);
            let image = await loadImage(await jmp.getBufferAsync('image/png'));
            return ctx.createPattern(image, this.type);
        }
    }

    /**
     * @returns {IPattern}
     */
    toJSON(): IPattern {
        return {
            type: this.type,
            src: this.src
        }
    }
}

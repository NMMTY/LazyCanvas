import type { IAnimationManager, AnyColorSpace } from "../../types";
import { ColorSpace } from "../../types/enum";

export class AnimationManager implements IAnimationManager {
    opts: {
        frameRate: number;
        maxColors: number;
        colorSpace: AnyColorSpace;
        loop: boolean;
        transparency: boolean;
        clear: boolean;
    };
    animated: boolean;
    debug: boolean;

    constructor(debug: boolean = false) {
        this.opts = {
            frameRate: 30,
            maxColors: 256,
            colorSpace: ColorSpace.RGB565,
            loop: true,
            transparency: true,
            clear: true
        };
        this.animated = false;
        this.debug = debug;
    }

    /**
     * Sets the frame rate of the animation.
     * @param frameRate {number} - The frame rate of the animation (by default 30).
     */
    setFrameRate(frameRate: number): this {
        this.opts.frameRate = frameRate;
        this.animated = true;
        return this;
    }

    /**
     * Sets the loop of the animation.
     * @param loop {boolean} - Whether the animation should loop or not (by default true).
     */
    setLoop(loop: boolean): this {
        this.opts.loop = loop;
        return this;
    }

    /**
     * Sets the transparency of the animation.
     * @param transparency {boolean} - Whether the animation should have transparency or not (by default true).
     */
    setTransparent(transparency: boolean): this {
        this.opts.transparency = transparency;
        return this;
    }

    /**
     * Sets the RGB format of the animation.
     * @param rgb {ColorSpace} - The RGB format of the animation (by default RGB565).
     */
    setRGBFormat(rgb: AnyColorSpace): this {
        this.opts.colorSpace = rgb;
        return this;
    }

    /**
     * Sets the maximum colors of the animation.
     * @param maxColors {number} - The maximum colors of the animation (by default 256).
     */
    setMaxColors(maxColors: number): this {
        this.opts.maxColors = maxColors;
        return this;
    }

    /**
     * Sets whether the content of previous frames will be cleared.
     * @param clear {boolean} - Whether the animation should clear or not (by default true).
     */
    setClear(clear: boolean): this {
        this.opts.clear = clear;
        return this;
    }

}
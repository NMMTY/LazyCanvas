import { AnyColorSpace } from "../../types";
import { ColorSpace } from "../../types/enum";

export interface IAnimationManager {
    options: IAnimationOptions;
    debug: boolean;
}

export interface IAnimationOptions {
    frameRate: number;
    maxColors: number;
    colorSpace: AnyColorSpace;
    loop: boolean;
    transparency: boolean;
    utils: {
        clear: boolean;
        buffer: {
            size: number;
        }
    }
}

export class AnimationManager implements IAnimationManager {
    options: IAnimationOptions;
    debug: boolean;

    constructor(opts?: { debug?: boolean, settings?: { options?: IAnimationOptions } }) {
        this.options = opts?.settings?.options || {
            frameRate: 30,
            maxColors: 256,
            colorSpace: ColorSpace.RGB565,
            loop: true,
            transparency: true,
            utils: {
                clear: true,
                buffer: {
                    size: 0
                }
            }
        } as IAnimationOptions;
        this.debug = opts?.debug || false;
    }

    /**
     * Sets the frame rate of the animation.
     * @param frameRate {number} - The frame rate of the animation (by default 30).
     */
    setFrameRate(frameRate: number): this {
        this.options.frameRate = frameRate;
        return this;
    }

    /**
     * Sets the loop of the animation.
     * @param loop {boolean} - Whether the animation should loop or not (by default true).
     */
    setLoop(loop: boolean): this {
        this.options.loop = loop;
        return this;
    }

    /**
     * Sets the transparency of the animation.
     * @param transparency {boolean} - Whether the animation should have transparency or not (by default true).
     */
    setTransparent(transparency: boolean): this {
        this.options.transparency = transparency;
        return this;
    }

    /**
     * Sets the RGB format of the animation.
     * @param rgb {ColorSpace} - The RGB format of the animation (by default RGB565).
     */
    setRGBFormat(rgb: AnyColorSpace): this {
        this.options.colorSpace = rgb;
        return this;
    }

    /**
     * Sets the maximum colors of the animation.
     * @param maxColors {number} - The maximum colors of the animation (by default 256).
     */
    setMaxColors(maxColors: number): this {
        this.options.maxColors = maxColors;
        return this;
    }

    /**
     * Sets whether the content of previous frames will be cleared.
     * @param clear {boolean} - Whether the animation should clear or not (by default true).
     * @param bufferSize {number} - The size of the frame buffer (by default 0).
     */
    setClear(clear: boolean, bufferSize?: number): this {
        this.options.utils.clear = clear;
        if (bufferSize) {
            this.options.utils.buffer.size = bufferSize;
        }
        return this;
    }

}
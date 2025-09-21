import { AnyColorSpace, ColorSpace } from "../../types";

/**
 * Interface representing the animation manager.
 */
export interface IAnimationManager {
    /**
     * The options for the animation manager.
     */
    options: IAnimationOptions;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;
}

/**
 * Interface representing the animation options.
 */
export interface IAnimationOptions {
    /**
     * The frame rate of the animation.
     */
    frameRate: number;

    /**
     * The maximum number of colors in the animation.
     */
    maxColors: number;

    /**
     * The color space used in the animation.
     */
    colorSpace: AnyColorSpace;

    /**
     * Whether the animation should loop.
     */
    loop: boolean;

    /**
     * Whether the animation should have transparency.
     */
    transparency: boolean;

    /**
     * Utility options for the animation.
     */
    utils: {
        /**
         * Whether to clear the content of previous frames.
         */
        clear: boolean;

        /**
         * Buffer-related options.
         */
        buffer: {
            /**
             * The size of the frame buffer.
             */
            size: number;
        };
    };
}

/**
 * Class representing the animation manager, which handles animation settings and options.
 */
export class AnimationManager implements IAnimationManager {
    /**
     * The options for the animation manager.
     */
    options: IAnimationOptions;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Constructs a new AnimationManager instance.
     * @param {Object} [opts] - Optional settings for the animation manager.
     * @param {boolean} [opts.debug] - Whether debugging is enabled.
     * @param {Object} [opts.settings] - Additional settings for the animation manager.
     * @param {IAnimationOptions} [opts.settings.options] - The animation options.
     */
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
     * @param {number} [frameRate] - The frame rate of the animation (default is 30).
     * @returns {this} The current instance for chaining.
     */
    setFrameRate(frameRate: number): this {
        this.options.frameRate = frameRate;
        return this;
    }

    /**
     * Sets whether the animation should loop.
     * @param {boolean} [loop] - Whether the animation should loop (default is true).
     * @returns {this} The current instance for chaining.
     */
    setLoop(loop: boolean): this {
        this.options.loop = loop;
        return this;
    }

    /**
     * Sets whether the animation should have transparency.
     * @param {boolean} [transparency] - Whether the animation should have transparency (default is true).
     * @returns {this} The current instance for chaining.
     */
    setTransparent(transparency: boolean): this {
        this.options.transparency = transparency;
        return this;
    }

    /**
     * Sets the RGB format of the animation.
     * @param {ColorSpace} [rgb] - The RGB format of the animation (default is RGB565).
     * @returns {this} The current instance for chaining.
     */
    setRGBFormat(rgb: AnyColorSpace): this {
        this.options.colorSpace = rgb;
        return this;
    }

    /**
     * Sets the maximum number of colors in the animation.
     * @param {number} [maxColors] - The maximum number of colors (default is 256).
     * @returns {this} The current instance for chaining.
     */
    setMaxColors(maxColors: number): this {
        this.options.maxColors = maxColors;
        return this;
    }

    /**
     * Sets whether the content of previous frames will be cleared.
     * @param {boolean} [clear] - Whether to clear the content of previous frames (default is true).
     * @param {number} [bufferSize] - The size of the frame buffer (default is 0).
     * @returns {this} The current instance for chaining.
     */
    setClear(clear: boolean, bufferSize?: number): this {
        this.options.utils.clear = clear;
        if (bufferSize) {
            this.options.utils.buffer.size = bufferSize;
        }
        return this;
    }
}
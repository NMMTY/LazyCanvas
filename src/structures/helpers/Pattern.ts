import { FillType, PatternType, AnyPatternType } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { Canvas, loadImage, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { Exporter } from "./Exporter";

/**
 * Interface representing a pattern.
 */
export interface IPattern {
    /**
     * The type of fill, which is always `Pattern` for this interface.
     */
    fillType: FillType;

    /**
     * The type of the pattern (e.g., repeat, no-repeat, etc.).
     */
    type: AnyPatternType;

    /**
     * The source of the pattern, which can be a string (URL or path) or a LazyCanvas instance.
     */
    src: string | LazyCanvas;
}

/**
 * Class representing a pattern with properties and methods to manipulate it.
 */
export class Pattern implements IPattern {
    /**
     * The type of fill, which is always `Pattern`.
     */
    fillType: FillType = FillType.Pattern;

    /**
     * The type of the pattern (e.g., repeat, no-repeat, etc.).
     */
    type: AnyPatternType;

    /**
     * The source of the pattern, which can be a string (URL or path) or a LazyCanvas instance.
     */
    src: string | LazyCanvas;

    /**
     * Constructs a new Pattern instance.
     * @param opts {Object} - Optional properties for the pattern.
     * @param opts.props {IPattern} - The pattern properties.
     */
    constructor(opts?: { props?: IPattern }) {
        this.type = opts?.props?.type || PatternType.Repeat;
        this.src = opts?.props?.src || '';
    }

    /**
     * Sets the type of the pattern.
     * @param type {AnyPatternType} - The type of the pattern (e.g., repeat, no-repeat).
     * @returns {this} The current instance for chaining.
     */
    setType(type: AnyPatternType) {
        this.type = type;
        return this;
    }

    /**
     * Sets the source of the pattern.
     * @param src {string | LazyCanvas} - The source of the pattern, which can be a string (URL or path) or a LazyCanvas instance.
     * @returns {this} The current instance for chaining.
     */
    setSrc(src: string | LazyCanvas) {
        this.src = src;
        return this;
    }

    /**
     * Draws the pattern on a canvas context.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @returns {Promise<CanvasPattern | null>} The created pattern or null if the pattern could not be created.
     */
    async draw(ctx: SKRSContext2D) {
        if (this.src instanceof LazyCanvas) {
            return ctx.createPattern((await this.src.manager.render.render('canvas')) as unknown as Canvas | SvgCanvas, this.type);
        } else {
            return ctx.createPattern(await loadImage(this.src), this.type);
        }
    }

    /**
     * Converts the Pattern instance to a JSON representation.
     * @returns {IPattern} The JSON representation of the pattern.
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
        };
    }
}
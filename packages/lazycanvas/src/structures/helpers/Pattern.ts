import {
  type AnyPatternType,
  FillType,
  ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  PatternType,
} from "../../types";
import { LazyError, loadImageFallback } from "../../utils";
import { LazyCanvas } from "../LazyCanvas";
import { serializeCanvas } from "./serialize";

/** Interface representing a pattern. */
export interface IPattern {
  fillType: FillType;
  type: AnyPatternType;
  src: string | LazyCanvas;
}

/**
 * A repeating image fill, usable wherever a color is accepted.
 *
 * @example
 * ```ts
 * new MorphLayer({
 *   color: new Pattern().setSrc("https://example.com/tile.png").setType("repeat"),
 *   size: { width: 200, height: 200 },
 * });
 * ```
 */
export class Pattern implements IPattern {
  fillType: FillType = FillType.Pattern;
  type: AnyPatternType;
  src: string | LazyCanvas;

  constructor(opts?: { props?: IPattern }) {
    this.type = opts?.props?.type || PatternType.Repeat;
    this.src = opts?.props?.src || "";
  }

  /**
   * Sets the repetition mode.
   *
   * @param {AnyPatternType} type - `repeat`, `repeat-x`, `repeat-y` or `no-repeat`.
   * @returns {this} The current instance for chaining.
   */
  setType(type: AnyPatternType): this {
    this.type = type;
    return this;
  }

  /**
   * Sets the pattern source.
   *
   * @param {string | LazyCanvas} src - An image URL, or another canvas to tile.
   * @returns {this} The current instance for chaining.
   */
  setSrc(src: string | LazyCanvas): this {
    this.src = src;
    return this;
  }

  /**
   * Resolves the pattern into a fill style for `ctx`.
   *
   * @param {ICanvasRenderingContext2D} ctx - The target context.
   * @param {object} [opts] - Where to find the adapter used to load the image: `adapter`, or the layers `manager` that carries it.
   */
  async draw(
    ctx: ICanvasRenderingContext2D,
    opts?: { adapter?: ICanvasAdapter; manager?: { adapter?: ICanvasAdapter } },
  ): Promise<any> {
    if (!this.src) throw new LazyError("Pattern source is not set");

    if (this.src instanceof LazyCanvas) {
      const canvas = await this.src.manager.render.render("canvas");
      return ctx.createPattern(canvas as any, this.type);
    }

    const adapter = opts?.adapter ?? opts?.manager?.adapter;
    const image = adapter ? await adapter.loadImage(this.src) : await loadImageFallback(this.src);
    return ctx.createPattern(image, this.type);
  }

  /** Serialises the pattern. */
  toJSON(): IPattern {
    let src = this.src;
    if (this.src instanceof LazyCanvas) {
      // @ts-ignore
      src = serializeCanvas(this.src);
    }
    return {
      fillType: this.fillType,
      type: this.type,
      src: src,
    };
  }
}

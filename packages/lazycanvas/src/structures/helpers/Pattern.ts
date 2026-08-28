import { FillType, PatternType, AnyPatternType, ICanvas, ICanvasRenderingContext2D } from "../../types";
import { LazyCanvas } from "../LazyCanvas";
import { serializeCanvas } from "./serialize";
import { LazyError, loadImageFallback } from "../../utils";

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
    this.src = opts?.props?.src || "";
  }

  setType(type: AnyPatternType): this {
    this.type = type;
    return this;
  }

  setSrc(src: string | LazyCanvas): this {
    this.src = src;
    return this;
  }

  async draw(ctx: ICanvasRenderingContext2D, adapter?: any): Promise<any> {
    if (!this.src) throw new LazyError("Pattern source is not set");

    if (this.src instanceof LazyCanvas) {
      const canvas = await this.src.manager.render.render("canvas");
      return ctx.createPattern(canvas as any, this.type);
    }

    const image = adapter
      ? await adapter.loadImage(this.src)
      : await loadImageFallback(this.src);
    return ctx.createPattern(image, this.type);
  }

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

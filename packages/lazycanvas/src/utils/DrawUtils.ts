import { type Signal, unwrap } from "../core/Signal";
import type { ICanvasRenderingContext2D } from "../types";
import type { StrokeOptions } from "../types";

export class DrawUtils {
  static drawShadow(ctx: ICanvasRenderingContext2D, shadow: any) {
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur || 0;
      ctx.shadowOffsetX = shadow.offsetX || 0;
      ctx.shadowOffsetY = shadow.offsetY || 0;
    }
  }

  /**
   * Adds a rectangle with rounded corners to the current path.
   *
   * One call into the canvas where the corners drawn by hand (`moveTo` and four `arcTo`) were five. When the
   * radii are too large for the sides (they overlap, which `roundRect` would quietly shrink), or the context
   * has no `roundRect`, the corners are drawn by hand as before.
   */
  static roundedRect(
    ctx: ICanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    rad: {
      leftTop?: number;
      rightTop?: number;
      rightBottom?: number;
      leftBottom?: number;
      all?: number;
    },
  ) {
    const topLeft = rad.leftTop || rad.all || 0;
    const topRight = rad.rightTop || rad.all || 0;
    const bottomRight = rad.rightBottom || rad.all || 0;
    const bottomLeft = rad.leftBottom || rad.all || 0;

    const fits =
      Math.min(topLeft, topRight, bottomRight, bottomLeft) >= 0 &&
      topLeft + topRight <= w &&
      bottomLeft + bottomRight <= w &&
      topLeft + bottomLeft <= h &&
      topRight + bottomRight <= h;

    if (fits && typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, [topLeft, topRight, bottomRight, bottomLeft]);
      return;
    }

    ctx.moveTo(x + w / 2, y);
    ctx.arcTo(x + w, y, x + w, y + h / 2, topRight);
    ctx.arcTo(x + w, y + h, x + w / 2, y + h, bottomRight);
    ctx.arcTo(x, y + h, x, y + h / 2, bottomLeft);
    ctx.arcTo(x, y, x + w / 2, y, topLeft);
  }

  static opacity(ctx: ICanvasRenderingContext2D, opacity: number | Signal<number> = 1) {
    const opacityValue = unwrap(opacity);

    if (opacityValue < 1) {
      ctx.globalAlpha = opacityValue;
    }
  }

  static filters(ctx: ICanvasRenderingContext2D, filters: string | null | undefined) {
    if (filters) {
      ctx.filter = filters;
    }
  }

  static fillStyle(
    ctx: ICanvasRenderingContext2D,
    color: string | CanvasGradient | CanvasPattern,
    fillStyle?: StrokeOptions,
  ) {
    if (fillStyle) {
      ctx.lineWidth = fillStyle.width;
      ctx.lineCap = fillStyle.cap || "butt";
      ctx.lineJoin = fillStyle.join || "miter";
      ctx.miterLimit = fillStyle.miterLimit || 10;
      if (fillStyle.dash) {
        ctx.setLineDash(fillStyle.dash);
        ctx.lineDashOffset = fillStyle.dashOffset || 0;
      }
      ctx.strokeStyle = color;
    } else {
      ctx.fillStyle = color;
    }
  }
}

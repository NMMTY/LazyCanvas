import { SKRSContext2D } from "@napi-rs/canvas";
import { Signal, unwrap } from "../core/Signal";
import { StrokeOptions } from "../types";

export class DrawUtils {
    static drawShadow(ctx: SKRSContext2D, shadow: any) {
        if (shadow) {
            ctx.shadowColor = shadow.color;
            ctx.shadowBlur = shadow.blur || 0;
            ctx.shadowOffsetX = shadow.offsetX || 0;
            ctx.shadowOffsetY = shadow.offsetY || 0;
        }
    }

    static opacity(ctx: SKRSContext2D, opacity: number | Signal<number> = 1) {
        const opacityValue = unwrap(opacity);

        if (opacityValue < 1) {
            ctx.globalAlpha = opacityValue;
        }
    }

    static filters(ctx: SKRSContext2D, filters: string | null | undefined) {
        if (filters) {
            ctx.filter = filters;
        }
    }

    static fillStyle(ctx: SKRSContext2D, color: string | CanvasGradient | CanvasPattern, fillStyle?: StrokeOptions) {
        if (fillStyle) {
            ctx.lineWidth = fillStyle.width;
            ctx.lineCap = fillStyle.cap || 'butt';
            ctx.lineJoin = fillStyle.join || 'miter';
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
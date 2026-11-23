import type { EasingFunction } from "./Signal";

/**
 * A cubic Bézier easing, like CSS `cubic-bezier(x1, y1, x2, y2)`.
 *
 * @param {number} x1 - X of the first control point, from `0` to `1`.
 * @param {number} y1 - Y of the first control point.
 * @param {number} x2 - X of the second control point, from `0` to `1`.
 * @param {number} y2 - Y of the second control point.
 * @returns {EasingFunction} A function from progress to eased progress.
 *
 * @example
 * ```ts
 * x.to(100, 1, { easing: cubicBezier(0.4, 0, 0.2, 1) });
 * ```
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError("cubicBezier: x1 and x2 must be between 0 and 1");
  }

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    // Find the curve parameter whose x is `progress`: Newton first, bisection if it stalls.
    let t = progress;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - progress;
      if (Math.abs(error) < 1e-7) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }

    let low = 0;
    let high = 1;
    t = progress;
    while (low < high) {
      const x = sampleX(t);
      if (Math.abs(x - progress) < 1e-7) break;
      if (progress > x) low = t;
      else high = t;
      t = (high - low) / 2 + low;
      if (high - low < 1e-9) break;
    }
    return sampleY(t);
  };
}

/**
 * A stepped easing: the value jumps `count` times instead of moving smoothly.
 *
 * @param {number} count - The number of steps.
 * @param {"end" | "start"} [jump] - Whether the jump happens at the end of each step (the
 * default, so the value starts at the beginning) or at its start.
 * @returns {EasingFunction} A function from progress to eased progress.
 */
export function steps(count: number, jump: "end" | "start" = "end"): EasingFunction {
  if (!(count >= 1) || !Number.isInteger(count)) {
    throw new RangeError("steps: count must be a whole number of at least 1");
  }
  return (progress: number) => {
    if (progress <= 0) return jump === "start" ? 1 / count : 0;
    if (progress >= 1) return 1;
    const index = Math.floor(progress * count) + (jump === "start" ? 1 : 0);
    return Math.min(index / count, 1);
  };
}

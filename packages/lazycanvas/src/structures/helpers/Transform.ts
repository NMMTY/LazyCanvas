import { Matrix, type MatrixLike } from "../../core/Matrix";
import type { Signal } from "../../core/Signal";
import { Vector2 } from "../../core/Vector2";
import { LazyError } from "../../utils/LazyUtil";

/** A number, or a signal that drives it. */
type Num = number | Signal<number>;
/** A pair of numbers, or a signal that drives the pair. */
type Pair = { x: Num; y: Num } | Signal<{ x: number; y: number }>;

/**
 * Where a rotation, scale or skew turns around, relative to the layer's own box.
 *
 * A keyword, or `{ x, y }` where each is pixels from the box's top-left corner (`20`) or a share
 * of its width or height (`"50%"`).
 */
export type TransformOrigin =
  | "center"
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"
  | { x: number | `${number}%`; y: number | `${number}%` };

/**
 * What a {@link Transform} is made of. Every field is optional, and numbers can be signals.
 */
export interface TransformProps {
  /** Move by this many pixels. */
  translate?: Pair;
  /** Turn by this many degrees (clockwise: `y` points down). */
  rotate?: Num;
  /** Scale: one number for both axes, or `{ x, y }`. */
  scale?: Num | Pair;
  /** Shear by this many degrees on each axis. Setting it turns on `origin` pivoting. */
  skew?: Pair;
  /**
   * The point `rotate`, `scale` and `skew` turn around. When it is left out the transform behaves
   * as it did before `origin` existed: rotation around the centre of the layer and scale from the
   * corner of the canvas. Set it to pivot all three around one point.
   */
  origin?: TransformOrigin;
  /** A matrix applied last, in the layer's own coordinates. All six numbers are needed. */
  matrix?: MatrixLike | DOMMatrix2DInit;
}

/** The box of a layer, in the coordinates it is drawn in. */
export interface TransformBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A transform with every number filled in. */
export interface ResolvedTransform {
  translate: { x: number; y: number };
  rotate: number;
  scale: { x: number; y: number };
  skew: { x: number; y: number };
  origin: TransformOrigin | undefined;
  matrix: Matrix | undefined;
}

const ORIGINS: Record<string, [number, number]> = {
  center: [0.5, 0.5],
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
};

const value = (input: unknown, fallback: number): number => {
  const resolved =
    input !== null &&
    typeof input === "object" &&
    "value" in input &&
    typeof input.value === "function"
      ? (input as { value(): unknown }).value()
      : input;
  return typeof resolved === "number" ? resolved : fallback;
};

const pair = (input: unknown, fallback: number): { x: number; y: number } => {
  const resolved =
    input !== null &&
    typeof input === "object" &&
    "value" in input &&
    typeof input.value === "function"
      ? (input as { value(): unknown }).value()
      : input;
  if (typeof resolved === "number") return { x: resolved, y: resolved };
  if (resolved !== null && typeof resolved === "object") {
    const point = resolved as { x?: unknown; y?: unknown };
    return { x: value(point.x, fallback), y: value(point.y, fallback) };
  }
  return { x: fallback, y: fallback };
};

/**
 * A 2D transform for a layer: move, rotate, scale and skew around a pivot, optionally followed by
 * a matrix.
 *
 * Any number in it can be a signal, so one `Transform` can animate several things at once; or put the
 * whole transform in a signal and blend it with `to()`, `spring()` and `keyframes()`.
 *
 * @example
 * ```ts
 * new Morph({
 *   color: "#3b82f6",
 *   size: { width: 120, height: 80 },
 *   transform: new Transform({ rotate: angle, scale: 1.2, origin: "top-left" }),
 * });
 * ```
 */
export class Transform implements TransformProps {
  public translate?: Pair;
  public rotate?: Num;
  public scale?: Num | Pair;
  public skew?: Pair;
  public origin?: TransformOrigin;
  public matrix?: MatrixLike | DOMMatrix2DInit;

  constructor(props: TransformProps = {}) {
    // Only what was given: the layer cache and `toJSON` should not see a field full of `undefined`.
    if (props.translate !== undefined) this.translate = props.translate;
    if (props.rotate !== undefined) this.rotate = props.rotate;
    if (props.scale !== undefined) this.scale = props.scale;
    if (props.skew !== undefined) this.skew = props.skew;
    if (props.origin !== undefined) this.origin = props.origin;
    if (props.matrix !== undefined) this.matrix = props.matrix;
  }

  /** A transform that changes nothing. */
  public static identity(): Transform {
    return new Transform();
  }

  /** A transform that is just a matrix. */
  public static fromMatrix(matrix: MatrixLike): Transform {
    return new Transform({ matrix });
  }

  /** The `Transform` for a transform or a plain object like `{ rotate: 30 }`. */
  public static from(input?: Transform | TransformProps | null): Transform {
    if (input instanceof Transform) return input;
    return new Transform(input ?? {});
  }

  /** A copy with some fields replaced. */
  public with(changes: TransformProps): Transform {
    return new Transform({ ...this, ...changes });
  }

  /** A copy that does not share its `{ x, y }` objects, so signals in it can be taken out safely. */
  public clone(): Transform {
    const copy = (field: unknown) =>
      field !== null && typeof field === "object" && !("value" in field && "to" in field)
        ? { ...(field as object) }
        : field;
    return new Transform({
      ...this,
      translate: copy(this.translate) as Pair | undefined,
      scale: copy(this.scale) as Num | Pair | undefined,
      skew: copy(this.skew) as Pair | undefined,
      origin: copy(this.origin) as TransformOrigin | undefined,
    });
  }

  /**
   * Whether this transform has no `origin` or `skew`, and so keeps the way a transform worked
   * before they were added (see {@link TransformProps.origin}).
   */
  public get legacy(): boolean {
    return this.origin === undefined && this.skew === undefined;
  }

  /** Every number read out (signals included), with the defaults filled in. */
  public resolved(): ResolvedTransform {
    let matrix: Matrix | undefined;
    if (this.matrix !== undefined) {
      const m = this.matrix as Record<string, unknown>;
      const a = m.a ?? m.m11;
      const b = m.b ?? m.m12;
      const c = m.c ?? m.m21;
      const d = m.d ?? m.m22;
      const e = m.e ?? m.m41;
      const f = m.f ?? m.m42;
      if (![a, b, c, d, e, f].every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new LazyError("The matrix transformation must be a valid matrix");
      }
      matrix = Matrix.from(m);
    }
    return {
      translate: pair(this.translate, 0),
      rotate: value(this.rotate, 0),
      scale: pair(this.scale, 1),
      skew: pair(this.skew, 0),
      origin: this.origin,
      matrix,
    };
  }

  /**
   * The matrix this transform applies to a layer drawn in `box`.
   *
   * @param {TransformBox} [box] - The layer's box, which `origin` is measured in. Without it the
   * box is empty and sits at `0, 0`.
   */
  public toMatrix(box: TransformBox = { x: 0, y: 0, width: 0, height: 0 }): Matrix {
    const t = this.resolved();
    let m = Matrix.translation(t.translate.x, t.translate.y);

    if (this.legacy) {
      // As before: rotate around the centre of the layer, scale from the canvas origin.
      if (t.rotate) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        m = m
          .multiply(Matrix.translation(cx, cy))
          .multiply(Matrix.rotation(t.rotate))
          .multiply(Matrix.translation(-cx, -cy));
      }
      m = m.multiply(Matrix.scaling(t.scale.x, t.scale.y));
    } else {
      const pivot = Transform.pivotOf(t.origin ?? "center", box);
      m = m
        .multiply(Matrix.translation(pivot.x, pivot.y))
        .multiply(Matrix.rotation(t.rotate))
        .multiply(Matrix.skewing(t.skew.x, t.skew.y))
        .multiply(Matrix.scaling(t.scale.x, t.scale.y))
        .multiply(Matrix.translation(-pivot.x, -pivot.y));
    }

    return t.matrix ? m.multiply(t.matrix) : m;
  }

  /**
   * The point an `origin` stands for in `box`.
   * @throws {LazyError} For an unknown keyword.
   */
  public static pivotOf(origin: TransformOrigin, box: TransformBox): Vector2 {
    if (typeof origin === "string") {
      const fraction = ORIGINS[origin];
      if (!fraction) {
        throw new LazyError(
          `Unknown transform origin "${origin}". Use one of: ${Object.keys(ORIGINS).join(", ")}, or { x, y }.`,
        );
      }
      return new Vector2(box.x + fraction[0] * box.width, box.y + fraction[1] * box.height);
    }
    const axis = (v: number | string, size: number) =>
      typeof v === "string" ? (Number.parseFloat(v) / 100) * size : v;
    return new Vector2(box.x + axis(origin.x, box.width), box.y + axis(origin.y, box.height));
  }

  /**
   * The blend of this transform and `other`, `t` of the way (`0` is this one, `1` is the other).
   *
   * Rotation and scale blend as numbers, so `0 → 360` is a full turn. A `matrix` on either side is
   * blended through its decomposed parts (see {@link Matrix.decompose}), so a turn does not shrink
   * in the middle. The `origin` and a missing field follow whichever side has it; if both do, the
   * origin jumps at the halfway point.
   *
   * This is what makes a `Signal<Transform>` animate: `createSignal(new Transform(...))`.
   */
  public lerp(other: Transform | TransformProps, t: number): Transform {
    const a = this.resolved();
    const b = Transform.from(other).resolved();
    const mix = (from: number, to: number) => from + (to - from) * t;
    const mixPair = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
      x: mix(from.x, to.x),
      y: mix(from.y, to.y),
    });

    const result: TransformProps = {
      translate: mixPair(a.translate, b.translate),
      rotate: mix(a.rotate, b.rotate),
      scale: mixPair(a.scale, b.scale),
    };

    if (this.skew !== undefined || other.skew !== undefined) {
      result.skew = mixPair(a.skew, b.skew);
    }
    const origin = t < 0.5 ? (a.origin ?? b.origin) : (b.origin ?? a.origin);
    if (origin !== undefined) result.origin = origin;

    if (a.matrix || b.matrix) {
      result.matrix = (a.matrix ?? Matrix.identity()).lerp(b.matrix ?? Matrix.identity(), t);
    }
    return new Transform(result);
  }

  /** The transform as a plain object, with signals read out. */
  public toJSON(): TransformProps {
    const t = this.resolved();
    const json: TransformProps = {};
    if (this.translate !== undefined) json.translate = t.translate;
    if (this.rotate !== undefined) json.rotate = t.rotate;
    if (this.scale !== undefined) json.scale = t.scale;
    if (this.skew !== undefined) json.skew = t.skew;
    if (this.origin !== undefined) json.origin = this.origin;
    if (t.matrix) json.matrix = t.matrix.toJSON();
    return json;
  }
}

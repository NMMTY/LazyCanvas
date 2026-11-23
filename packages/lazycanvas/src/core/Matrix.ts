import { LazyError } from "../utils/LazyUtil";
import { Vector2 } from "./Vector2";

/** The six numbers of a 2D affine matrix, named as in CSS `matrix(a, b, c, d, e, f)`. */
export interface MatrixLike {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** A matrix taken apart into the moves it is made of. */
export interface DecomposedMatrix {
  /** Offset. */
  translate: Vector2;
  /** Rotation in degrees. */
  rotate: number;
  /** Scale along the (rotated) axes; negative when the matrix mirrors. */
  scale: Vector2;
  /** Horizontal shear in degrees (`x += tan(skew) * y`, applied after scaling and before rotating). */
  skew: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * A 2D affine transform: a rotation, scale, shear and offset in one object.
 *
 * `x' = a·x + c·y + e` and `y' = b·x + d·y + f`, the same layout as CSS `matrix()` and
 * `ctx.transform()`. Matrices are immutable.
 *
 * Multiplication follows the usual order: `outer.multiply(inner)` applies `inner` first, so
 * `parent.multiply(child)` maps a child's own coordinates to the parent's.
 *
 * @example
 * ```ts
 * const m = Matrix.translation(100, 50).multiply(Matrix.rotation(30));
 * m.apply({ x: 10, y: 0 });      // where the point (10, 0) ends up
 * m.inverse().apply(point);       // and back
 * ```
 */
export class Matrix implements MatrixLike {
  public readonly a: number;
  public readonly b: number;
  public readonly c: number;
  public readonly d: number;
  public readonly e: number;
  public readonly f: number;

  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  /** The matrix that changes nothing. */
  public static identity(): Matrix {
    return new Matrix();
  }

  /** A move by `(x, y)`. */
  public static translation(x: number, y: number): Matrix {
    return new Matrix(1, 0, 0, 1, x, y);
  }

  /** A rotation by `degrees` around the origin (clockwise on a canvas, where `y` points down). */
  public static rotation(degrees: number): Matrix {
    const radians = toRadians(degrees);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Matrix(cos, sin, -sin, cos, 0, 0);
  }

  /** A scale around the origin. With one number both axes are scaled. */
  public static scaling(x: number, y: number = x): Matrix {
    return new Matrix(x, 0, 0, y, 0, 0);
  }

  /** A shear: `x += tan(xDegrees) · y` and `y += tan(yDegrees) · x`, like CSS `skew()`. */
  public static skewing(xDegrees: number, yDegrees = 0): Matrix {
    return new Matrix(1, Math.tan(toRadians(yDegrees)), Math.tan(toRadians(xDegrees)), 1, 0, 0);
  }

  /**
   * A matrix from `{ a, b, c, d, e, f }`, or from the `m11…m42` names a `DOMMatrix` also has.
   * Missing numbers are those of the identity.
   */
  public static from(init: object): Matrix {
    const source = init as Record<string, unknown>;
    const num = (value: unknown, fallback: number) =>
      typeof value === "number" ? value : fallback;
    return new Matrix(
      num(source.a ?? source.m11, 1),
      num(source.b ?? source.m12, 0),
      num(source.c ?? source.m21, 0),
      num(source.d ?? source.m22, 1),
      num(source.e ?? source.m41, 0),
      num(source.f ?? source.m42, 0),
    );
  }

  /** Builds a matrix from a rotation, scale, shear and offset: the opposite of {@link Matrix.decompose}. */
  public static compose(parts: Partial<DecomposedMatrix>): Matrix {
    const translate = parts.translate ?? Vector2.zero;
    const scale = parts.scale ?? new Vector2(1, 1);
    return Matrix.translation(translate.x, translate.y)
      .multiply(Matrix.rotation(parts.rotate ?? 0))
      .multiply(Matrix.skewing(parts.skew ?? 0))
      .multiply(Matrix.scaling(scale.x, scale.y));
  }

  /** `this` applied after `other`: the result moves a point by `other` first and then by `this`. */
  public multiply(other: MatrixLike): Matrix {
    return new Matrix(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    );
  }

  /** The point after the transform. */
  public apply(point: { x: number; y: number }): Vector2 {
    return new Vector2(
      this.a * point.x + this.c * point.y + this.e,
      this.b * point.x + this.d * point.y + this.f,
    );
  }

  /** A direction after the transform: rotated and scaled like a point, but not moved. */
  public applyToVector(vector: { x: number; y: number }): Vector2 {
    return new Vector2(
      this.a * vector.x + this.c * vector.y,
      this.b * vector.x + this.d * vector.y,
    );
  }

  /** `a·d − b·c`: how much areas change, negative if the matrix mirrors. */
  public get determinant(): number {
    return this.a * this.d - this.b * this.c;
  }

  /** Whether the matrix can be undone (it does not squash everything onto a line). */
  public get invertible(): boolean {
    const det = this.determinant;
    return Number.isFinite(det) && Math.abs(det) > 1e-12;
  }

  /**
   * The matrix that undoes this one.
   * @throws {LazyError} If the matrix flattens space (a scale of `0`) and cannot be undone.
   */
  public inverse(): Matrix {
    if (!this.invertible) throw new LazyError("This matrix cannot be inverted (its scale is 0)");
    const det = this.determinant;
    return new Matrix(
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    );
  }

  /**
   * Splits the matrix into an offset, rotation, scale and shear, so that
   * `Matrix.compose(m.decompose())` gives `m` back. This is how two matrices are blended without
   * the shrinking a straight blend of the six numbers would cause in the middle of a turn.
   *
   * A matrix that flattens space has no rotation; it is reported as `0`.
   */
  public decompose(): DecomposedMatrix {
    const translate = new Vector2(this.e, this.f);

    let scaleX = Math.hypot(this.a, this.b);
    if (scaleX === 0) {
      // The x axis collapsed to a point: no direction to read a rotation from.
      return { translate, rotate: 0, scale: new Vector2(0, Math.hypot(this.c, this.d)), skew: 0 };
    }

    const ux = this.a / scaleX;
    const uy = this.b / scaleX;
    let shear = ux * this.c + uy * this.d;
    const cx = this.c - ux * shear;
    const cy = this.d - uy * shear;
    const scaleY = Math.hypot(cx, cy);
    shear = scaleY === 0 ? 0 : shear / scaleY;

    // A mirror shows up as a negative determinant: put it on x so the rotation stays in range.
    let rotate = toDegrees(Math.atan2(uy, ux));
    if (this.determinant < 0) {
      scaleX = -scaleX;
      rotate = toDegrees(Math.atan2(-uy, -ux));
      shear = -shear;
    }

    return {
      translate,
      rotate,
      scale: new Vector2(scaleX, scaleY),
      skew: toDegrees(Math.atan(shear)),
    };
  }

  /** The six numbers as `[a, b, c, d, e, f]`, the order `ctx.transform()` takes. */
  public toArray(): [number, number, number, number, number, number] {
    return [this.a, this.b, this.c, this.d, this.e, this.f];
  }

  /** Whether two matrices are the same, within `epsilon`. */
  public equals(other: MatrixLike, epsilon = 1e-9): boolean {
    return (
      Math.abs(this.a - other.a) <= epsilon &&
      Math.abs(this.b - other.b) <= epsilon &&
      Math.abs(this.c - other.c) <= epsilon &&
      Math.abs(this.d - other.d) <= epsilon &&
      Math.abs(this.e - other.e) <= epsilon &&
      Math.abs(this.f - other.f) <= epsilon
    );
  }

  /** The blend of two matrices, through their decomposed parts (see {@link Matrix.decompose}). */
  public lerp(other: MatrixLike, t: number): Matrix {
    const from = this.decompose();
    const to = Matrix.from(other).decompose();
    return Matrix.compose({
      translate: from.translate.lerp(to.translate, t),
      rotate: from.rotate + (to.rotate - from.rotate) * t,
      scale: from.scale.lerp(to.scale, t),
      skew: from.skew + (to.skew - from.skew) * t,
    });
  }

  /** `{ a, b, c, d, e, f }`, which is also a valid `DOMMatrix2DInit`. */
  public toJSON(): MatrixLike {
    return { a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f };
  }
}

/**
 * A point or a direction in 2D: `{ x, y }` with the usual arithmetic.
 *
 * Vectors are immutable: every method returns a new one. A `Vector2` is also a plain
 * `{ x, y }`, so it can be used wherever a point is expected, and a signal holding one
 * is blended by {@link Vector2.lerp} rather than snapping.
 *
 * @example
 * ```ts
 * const center = new Vector2(240, 135);
 * const orbit = center.add(Vector2.fromPolar(100, 45)); // 100 px away at 45°
 * ```
 */
export class Vector2 {
  /** Horizontal component. */
  public readonly x: number;
  /** Vertical component. */
  public readonly y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /** The zero vector. */
  public static get zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /** Makes a vector from anything with `x` and `y`. */
  public static from(point: { x: number; y: number }): Vector2 {
    return point instanceof Vector2 ? point : new Vector2(point.x, point.y);
  }

  /**
   * A vector from a length and an angle.
   * @param {number} length - Distance from the origin.
   * @param {number} degrees - Angle in degrees, `0` along `x` and `90` along `y` (down on a canvas).
   */
  public static fromPolar(length: number, degrees: number): Vector2 {
    const radians = (degrees * Math.PI) / 180;
    return new Vector2(length * Math.cos(radians), length * Math.sin(radians));
  }

  /** The sum of two vectors. */
  public add(other: { x: number; y: number }): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  /** The difference of two vectors. */
  public sub(other: { x: number; y: number }): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  /** Multiplies by a number, or each component by the matching one of another vector. */
  public mul(factor: number | { x: number; y: number }): Vector2 {
    return typeof factor === "number"
      ? new Vector2(this.x * factor, this.y * factor)
      : new Vector2(this.x * factor.x, this.y * factor.y);
  }

  /** Divides by a number, or each component by the matching one of another vector. */
  public div(divisor: number | { x: number; y: number }): Vector2 {
    return typeof divisor === "number"
      ? new Vector2(this.x / divisor, this.y / divisor)
      : new Vector2(this.x / divisor.x, this.y / divisor.y);
  }

  /** The vector pointing the other way. */
  public negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  /** The dot product. */
  public dot(other: { x: number; y: number }): number {
    return this.x * other.x + this.y * other.y;
  }

  /** The 2D cross product: the signed area of the parallelogram the two span. */
  public cross(other: { x: number; y: number }): number {
    return this.x * other.y - this.y * other.x;
  }

  /** Distance from the origin. */
  public get length(): number {
    return Math.hypot(this.x, this.y);
  }

  /** The angle in degrees, from `-180` to `180`, `0` along `x`. */
  public get angle(): number {
    return (Math.atan2(this.y, this.x) * 180) / Math.PI;
  }

  /** Distance to another point. */
  public distanceTo(other: { x: number; y: number }): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  /** The vector with length `1` in the same direction; the zero vector stays zero. */
  public normalize(): Vector2 {
    const length = this.length;
    return length === 0 ? this : this.div(length);
  }

  /** Turns the vector by `degrees` around the origin. */
  public rotate(degrees: number): Vector2 {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  /** The point `t` of the way to `other`; `t` is not limited to `0..1`. */
  public lerp(other: { x: number; y: number }, t: number): Vector2 {
    return new Vector2(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t);
  }

  /** Whether two vectors are the same, within `epsilon`. */
  public equals(other: { x: number; y: number }, epsilon = 1e-9): boolean {
    return Math.abs(this.x - other.x) <= epsilon && Math.abs(this.y - other.y) <= epsilon;
  }

  /** A plain `{ x, y }`. */
  public toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}

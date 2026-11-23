import { withDuration } from "./Duration";
import { type Interpolator, getInterpolator, lerpColorHSL, lerpColorRGB } from "./Interpolation";
import { type Keyframe, Keyframes, type KeyframesOptions } from "./Keyframes";
import type { TraceListener } from "./SignalTrace";
import { type SpringConfig, type SpringPresetName, solveSpring } from "./Spring";

/**
 * Tolerance, in seconds, when comparing elapsed time with a duration.
 *
 * The scheduler advances time in many small steps, and adding `1/240` two hundred
 * and forty times does not give exactly `1`. Without a tolerance an animation that
 * should end at one second would still be one step short of it.
 */
export const TIME_EPSILON = 1e-9;

/**
 * Whether `elapsed` seconds have reached `duration`, within {@link TIME_EPSILON}.
 */
export function timeReached(elapsed: number, duration: number): boolean {
  return elapsed + TIME_EPSILON >= duration;
}

/**
 * Easing function type
 */
export type EasingFunction = (t: number) => number;

/**
 * Standard easing functions
 */
export const Easing = {
  linear: (t: number) => t,

  // Quadratic
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) ** 2,
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),

  // Quartic
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2),

  // Quintic
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 - (1 - t) ** 5,
  easeInOutQuint: (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - (-2 * t + 2) ** 5 / 2),

  // Sine
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential
  easeInExpo: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },

  // Circular
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t ** 2),
  easeOutCirc: (t: number) => Math.sqrt(1 - (t - 1) ** 2),
  easeInOutCirc: (t: number) =>
    t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,

  // Back
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
      : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // Bounce
  easeInBounce: (t: number) => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    }
    if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    }
    if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    }
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  easeInOutBounce: (t: number) =>
    t < 0.5 ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2 : (1 + Easing.easeOutBounce(2 * t - 1)) / 2,
};

/**
 * Thread generator type - the core of animation system
 */
export type ThreadGenerator = Generator<undefined | number, void, number | undefined>;

/**
 * Tween configuration
 */
export interface TweenConfig<T> {
  to: T;
  duration: number;
  easing?: EasingFunction;
  interpolator?: Interpolator<T>;
  colorSpace?: "rgb" | "hsl";
}

/**
 * Signal options
 */
export interface SignalOptions<T> {
  interpolator?: Interpolator<T>;
  colorSpace?: "rgb" | "hsl";
}

/**
 * Signal class - reactive value that can be animated
 */
export class Signal<T = number> {
  private _value: T;
  private _initialValue: T;
  private _velocity = 0;
  private _currentThread: ThreadGenerator | null = null;
  /** Timelines following this signal. Weak, so a signal does not keep a finished scene's history alive. */
  private _traces: Array<WeakRef<TraceListener>> | undefined;
  private _interpolator: Interpolator<T>;
  private _colorSpace: "rgb" | "hsl";

  constructor(initial: T, options?: SignalOptions<T>) {
    this._value = initial;
    this._initialValue = initial;
    this._interpolator = options?.interpolator || getInterpolator(initial, initial);
    this._colorSpace = options?.colorSpace || "rgb";
  }

  /**
   * Get current value at specific time (backward compatibility)
   */
  public get(time: number): T {
    return this._value;
  }

  /**
   * Get current value (sync)
   */
  public value(): T {
    return this._value;
  }

  /**
   * How fast a numeric signal is changing, in units per second.
   *
   * It is what a spring continues from when it takes over from another animation, so a
   * signal that is moving does not stop dead and start again. `0` for a signal that is
   * still, and for values that are not numbers.
   */
  public velocity(): number {
    return this._velocity;
  }

  /**
   * Set value directly
   */
  public set(value: T): void {
    this._value = value;
    this._velocity = 0;
    this._currentThread = null;
    this.changed();
  }

  /**
   * Puts a value back without touching the running animation.
   *
   * This is what the scene's timeline uses when it moves to another point in time:
   * unlike {@link Signal.set} it does not cancel the animation that drives the
   * signal. Call `set` for ordinary assignments.
   */
  public restore(value: T, velocity = 0): void {
    this._value = value;
    this._velocity = velocity;
  }

  /**
   * Reset to initial value
   */
  public reset(): void {
    this._value = this._initialValue;
    this._velocity = 0;
    this._currentThread = null;
    this.changed();
  }

  /**
   * Has a timeline follow this signal: it is told whenever the value changes.
   * @internal
   */
  public addTrace(trace: TraceListener): void {
    this._traces ??= [];
    if (!this._traces.some((ref) => ref.deref() === trace)) {
      this._traces.push(new WeakRef(trace));
    }
  }

  private changed(): void {
    const traces = this._traces;
    if (traces === undefined) return;
    for (let i = traces.length - 1; i >= 0; i--) {
      const trace = traces[i].deref();
      if (trace) trace.dirty(this);
      else traces.splice(i, 1);
    }
  }

  /**
   * Animate to a new value - returns a generator
   */
  public to(
    value: T,
    duration: number,
    config?: Partial<TweenConfig<T>> & { easing?: EasingFunction },
  ): ThreadGenerator {
    return withDuration(this.tween(value, duration, config), Math.max(duration, 0));
  }

  /**
   * Moves to a new value like a spring: by physics rather than on a fixed schedule.
   *
   * There is no duration; the spring runs until it settles. A numeric signal that is already
   * moving keeps its speed, so interrupting one spring with another is smooth. Other values
   * (colours, `{ x, y }` points) are blended with the same motion, starting from rest.
   *
   * The motion is solved exactly rather than stepped, so it is the same at any frame rate and
   * on any seek.
   *
   * @param {T} target - The value to settle on.
   * @param {SpringConfig | SpringPresetName} [config] - `stiffness`, `damping`, `mass`, or the
   * name of a preset such as `"wobbly"`.
   *
   * @example
   * ```ts
   * yield* x.spring(300);                                    // default
   * yield* x.spring(300, "wobbly");                          // preset
   * yield* x.spring(300, { stiffness: 120, damping: 8 });    // your own
   * ```
   */
  public spring(target: T, config: SpringConfig | SpringPresetName = {}): ThreadGenerator {
    // Solved once here to validate the config and to learn how long it will take from now;
    // the real run solves again from wherever the signal is when it starts.
    const estimate = this.solve(target, config);
    return withDuration(this.springRun(target, config), estimate.motion.duration);
  }

  /**
   * Moves through a list of keyframes.
   *
   * If the first keyframe is later than time `0`, the signal starts from its current value.
   *
   * @param {Array<Keyframe<T> | T>} frames - `{ at, value }` keyframes (`at` in seconds, or
   * `offset` from `0` to `1` of the `duration`), or plain values spread evenly over `duration`.
   * @param {KeyframesOptions<T>} [options] - `duration`, a default `easing`, `colorSpace`.
   *
   * @example
   * ```ts
   * yield* x.keyframes([
   *   { at: 0.4, value: 300, easing: Easing.easeOutCubic },
   *   { at: 1, value: 120 },
   * ]);
   * yield* x.keyframes([0, 100, 50], { duration: 2 });
   * ```
   */
  public keyframes(
    frames: Array<Keyframe<T> | T>,
    options: KeyframesOptions<T> = {},
  ): ThreadGenerator {
    const track = new Keyframes(frames, { colorSpace: this._colorSpace, ...options });
    return withDuration(this.keyframesRun(frames, options), track.duration);
  }

  /**
   * Wait for a duration without changing value
   */
  public wait(duration: number): ThreadGenerator {
    return withDuration(this.waitRun(duration), Math.max(duration, 0));
  }

  private *tween(
    value: T,
    duration: number,
    config?: Partial<TweenConfig<T>> & { easing?: EasingFunction },
  ): ThreadGenerator {
    const from = this._value;
    const easing = config?.easing || Easing.linear;
    const interpolator = config?.interpolator || this._getInterpolator(from, value);

    if (duration <= 0) {
      this.assign(value, 0);
      return;
    }

    let elapsed = 0;

    while (!timeReached(elapsed, duration)) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60; // Default 60fps
      elapsed += actualDelta;

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      this.assign(interpolator(from, value, easedProgress), actualDelta);

      // Critical: ensure we don't overshoot
      if (timeReached(elapsed, duration)) {
        this.assign(value, actualDelta);
        break;
      }
    }
  }

  private *springRun(target: T, config: SpringConfig | SpringPresetName): ThreadGenerator {
    const { motion, from, numeric, interpolator } = this.solve(target, config);

    if (motion.duration <= 0) {
      this.assign(target, 0);
      this._velocity = 0;
      this.changed();
      return;
    }

    let elapsed = 0;
    while (!timeReached(elapsed, motion.duration)) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60;
      elapsed += actualDelta;

      if (timeReached(elapsed, motion.duration)) break;

      const position = motion.position(elapsed);
      this._value = numeric ? (position as unknown as T) : interpolator(from, target, position);
      this._velocity = numeric ? motion.velocity(elapsed) : 0;
      this.changed();
    }

    this._value = target;
    this._velocity = 0;
    this.changed();
  }

  private *keyframesRun(
    frames: Array<Keyframe<T> | T>,
    options: KeyframesOptions<T>,
  ): ThreadGenerator {
    // Built here, not when `keyframes()` was called: the start value is whatever the signal
    // holds now, which may have been changed by an animation that ran before this one.
    const track = new Keyframes(frames, {
      colorSpace: this._colorSpace,
      from: this._value,
      ...options,
    });

    this.assign(track.valueAt(0), 0);

    let elapsed = 0;
    while (!timeReached(elapsed, track.duration)) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60;
      elapsed += actualDelta;

      this.assign(track.valueAt(Math.min(elapsed, track.duration)), actualDelta);
    }

    this.assign(track.valueAt(track.duration), 0);
    this._velocity = 0;
    this.changed();
  }

  private *waitRun(duration: number): ThreadGenerator {
    let elapsed = 0;

    while (!timeReached(elapsed, duration)) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60;
      elapsed += actualDelta;
    }
  }

  /**
   * Run animation from generator
   */
  public run(generator: ThreadGenerator): this {
    this._currentThread = generator;
    return this;
  }

  /**
   * Update signal (called by scheduler)
   */
  public update(delta: number): boolean {
    if (!this._currentThread) return false;

    const result = this._currentThread.next(delta);

    if (result.done) {
      this._currentThread = null;
      return false;
    }

    return true;
  }

  /**
   * Check if signal has active animation
   */
  public isAnimating(): boolean {
    return this._currentThread !== null;
  }

  /** Sets the value and, for numbers, the speed it moved at over the last `delta` seconds. */
  private assign(value: T, delta: number): void {
    const previous = this._value;
    this._value = value;
    this._velocity =
      delta > 0 && typeof previous === "number" && typeof value === "number"
        ? (value - previous) / delta
        : 0;
    this.changed();
  }

  /** Solves a spring from where this signal is now. */
  private solve(target: T, config: SpringConfig | SpringPresetName) {
    const from = this._value;
    const numeric = typeof from === "number" && typeof target === "number";
    const interpolator = this._getInterpolator(from, target);
    const motion = numeric
      ? solveSpring(from as number, target as number, config, this._velocity)
      : // Anything else is blended by progress, from 0 to 1.
        solveSpring(0, 1, config);
    return { motion, from, numeric, interpolator };
  }

  /**
   * Internal: get interpolator for values
   */
  private _getInterpolator(from: T, to: T): Interpolator<T> {
    // Check if it's a color string
    if (typeof from === "string" && typeof to === "string") {
      const fromStr = from as string;
      if (fromStr.startsWith("#") || fromStr.startsWith("rgb") || fromStr.startsWith("hsl")) {
        return (this._colorSpace === "hsl"
          ? lerpColorHSL
          : lerpColorRGB) as unknown as Interpolator<T>;
      }
    }

    return this._interpolator;
  }
}

/**
 * Create a new signal
 */
export function createSignal<T = number>(initial: T, options?: SignalOptions<T>): Signal<T> {
  return new Signal<T>(initial, options);
}

/**
 * Type guard for signals
 */
export function isSignal<T>(value: any): value is Signal<T> {
  return value instanceof Signal;
}

/**
 * Unwrap signal or return value
 */
export function unwrap<T>(value: T | Signal<T>): T extends Signal<infer U> ? U : T {
  if (isSignal(value)) {
    return value.value() as any;
  }
  return value as any;
}

/**
 * Reset multiple signals to their initial values
 */
export function resetSignals(...signals: Signal<any>[]): void {
  for (const signal of signals) {
    signal.reset();
  }
}

export type SignalValue<T> = T | Signal<T>;

export default Signal;

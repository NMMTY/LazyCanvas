import { type Clock, TIME_EPS, createClock, requireClock, withClock } from "./Clock";
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
 * What drives a signal while an animation runs on it: its value, as a function of time.
 *
 * The animation does not write the value on every step; it installs a driver and sleeps until the driver ends,
 * and the value is worked out when somebody reads it. That is why a scene with thousands of running tweens costs
 * nothing between the moments they start and end, and why the value at any time is exact.
 */
export interface Driver<T> {
  /** Time it starts at, in seconds. */
  readonly start: number;
  /** Time it ends at, in seconds. */
  readonly end: number;
  /** The value at `time`, which is between `start` and `end`. */
  valueAt(time: number): T;
  /** How fast a numeric value is changing at `time`, in units per second. */
  velocityAt(time: number): number;
  /** The thread that installed it. @internal */
  owner?: unknown;
}

/**
 * Everything about a signal that a timeline has to put back to go to an earlier time.
 */
export interface SignalState<T = unknown> {
  driver: Driver<T> | null;
  /** The clock the driver is read against. */
  clock: Clock | null;
  value: T;
  velocity: number;
}

/** The window over which the speed of a numeric driver is measured, in seconds: one step of the grid. */
const VELOCITY_WINDOW = 1 / 240;

/** The slope of `valueAt` over the last window before `time` (or the first one after it, at the start). */
function slopeAt(
  valueAt: (time: number) => number,
  start: number,
  end: number,
  time: number,
): number {
  const a = Math.max(start, Math.min(time - VELOCITY_WINDOW, end - VELOCITY_WINDOW));
  const b = Math.min(end, a + VELOCITY_WINDOW);
  return b > a ? (valueAt(b) - valueAt(a)) / (b - a) : 0;
}

/**
 * Signal class - reactive value that can be animated
 */
export class Signal<T = number> {
  private _value: T;
  private _initialValue: T;
  private _velocity = 0;
  private _currentThread: ThreadGenerator | null = null;
  /** What drives the value right now, instead of `_value`. */
  private _driver: Driver<T> | null = null;
  /** The clock `_driver` is read against. */
  private _clock: Clock | null = null;
  /** Timelines following this signal. Weak, so a signal does not keep a finished scene's history alive. */
  private _traces: Array<WeakRef<TraceListener>> | undefined;
  private _interpolator: Interpolator<T>;
  private _colorSpace: "rgb" | "hsl";
  /** For stepping the signal's own animation by hand with `update`. */
  private _manual: { clock: Clock; wake: number | null; primed: boolean } | undefined;

  constructor(initial: T, options?: SignalOptions<T>) {
    this._value = initial;
    this._initialValue = initial;
    this._interpolator = options?.interpolator || getInterpolator(initial, initial);
    this._colorSpace = options?.colorSpace || "rgb";
  }

  /**
   * The value at a given time. While an animation drives the signal this is the value it has at `time`.
   */
  public get(time: number): T {
    const driver = this._driver;
    if (driver === null) return this._value;
    return driver.valueAt(
      time < driver.start ? driver.start : time > driver.end ? driver.end : time,
    );
  }

  /**
   * Get current value (sync)
   */
  public value(): T {
    const driver = this._driver;
    if (driver === null) return this._value;
    const time = (this._clock as Clock).time;
    return driver.valueAt(
      time < driver.start ? driver.start : time > driver.end ? driver.end : time,
    );
  }

  /**
   * How fast a numeric signal is changing, in units per second.
   *
   * It is what a spring continues from when it takes over from another animation, so a
   * signal that is moving does not stop dead and start again. `0` for a signal that is
   * still, and for values that are not numbers.
   */
  public velocity(): number {
    const driver = this._driver;
    if (driver === null) return this._velocity;
    const time = (this._clock as Clock).time;
    return driver.velocityAt(
      time < driver.start ? driver.start : time > driver.end ? driver.end : time,
    );
  }

  /**
   * Set value directly
   */
  public set(value: T): void {
    this.dropDriver();
    this._value = value;
    this._velocity = 0;
    this._currentThread = null;
    this.changed();
  }

  /**
   * Puts a value back without touching the running animation.
   *
   * Prefer {@link Signal.restoreState}, which also puts back what was driving the signal. Call `set` for
   * ordinary assignments.
   */
  public restore(value: T, velocity = 0): void {
    this._driver = null;
    this._value = value;
    this._velocity = velocity;
  }

  /**
   * What a timeline needs to remember to put the signal back as it is now.
   * @internal
   */
  public captureState(): SignalState<T> {
    return {
      driver: this._driver,
      clock: this._clock,
      value: this._value,
      velocity: this._velocity,
    };
  }

  /**
   * Puts the signal back as {@link Signal.captureState} found it, without touching the running animation's thread.
   * @internal
   */
  public restoreState(state: SignalState<T>): void {
    this._driver = state.driver;
    if (state.driver !== null) this._clock = state.clock;
    this._value = state.value;
    this._velocity = state.velocity;
  }

  /**
   * Stops what drives the signal and leaves it at the value it has now.
   * @internal
   */
  public freeze(): void {
    const driver = this._driver;
    if (driver === null) return;
    const value = this.value();
    const velocity = this.velocity();
    this.dropDriver();
    this._value = value;
    this._velocity = velocity;
    this.changed();
  }

  /**
   * Whether the animation running on this signal was started by `owner`.
   * @internal
   */
  public drivenBy(owner: unknown): boolean {
    // The animation that installed the driver may be one of several side by side in a thread, each with
    // its own owner pointing to the one it belongs to.
    let current = this._driver?.owner;
    while (current !== undefined && current !== null) {
      if (current === owner) return true;
      current = (current as { parent?: unknown }).parent;
    }
    return false;
  }

  /**
   * Reset to initial value
   */
  public reset(): void {
    this.dropDriver();
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

  private dropDriver(): void {
    if (this._driver === null) return;
    this._driver = null;
    this._clock?.driven.delete(this);
  }

  /** Puts a driver on the signal. An animation that was driving it is replaced. */
  private drive(driver: Driver<T>, clock: Clock): void {
    driver.owner = clock.owner;
    this._driver = driver;
    this._clock = clock;
    clock.driven.add(this);
    this.changed();
  }

  /** The animation that installed `driver` has ended: the signal stays at its final value. */
  private settle(driver: Driver<T>, value: T, velocity = 0): void {
    // Something else may have taken over while this one was running; it keeps the signal.
    if (this._driver !== driver) return;
    this._driver = null;
    this._clock?.driven.delete(this);
    this._value = value;
    this._velocity = velocity;
    this.changed();
  }

  /** Puts a value straight on the signal, as an animation of no length does. */
  private jump(value: T): void {
    this.dropDriver();
    this._value = value;
    this._velocity = 0;
    this.changed();
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
    const from = this.value();
    const easing = config?.easing || Easing.linear;
    const interpolator = config?.interpolator || this._getInterpolator(from, value);

    if (duration <= 0) {
      this.jump(value);
      return;
    }

    const clock = requireClock();
    const start = clock.time;
    const end = start + duration;
    const numeric = typeof from === "number" && typeof value === "number";

    // At either end it is exactly the value it started from or goes to, not what an interpolator makes of 0 or 1.
    const valueAt = (time: number): T => {
      const progress = (time - start) / duration;
      if (progress <= 0) return from;
      if (progress >= 1) return value;
      return interpolator(from, value, easing(progress));
    };
    const driver: Driver<T> = {
      start,
      end,
      valueAt,
      velocityAt: numeric
        ? (time) => slopeAt(valueAt as unknown as (t: number) => number, start, end, time)
        : () => 0,
    };

    this.drive(driver, clock);
    yield end;
    // The speed it ends at is what whatever comes next continues from.
    this.settle(driver, value, driver.velocityAt(end));
  }

  private *springRun(target: T, config: SpringConfig | SpringPresetName): ThreadGenerator {
    const { motion, from, numeric, interpolator } = this.solve(target, config);

    if (motion.duration <= 0) {
      this.jump(target);
      return;
    }

    const clock = requireClock();
    const start = clock.time;
    const end = start + motion.duration;

    const driver: Driver<T> = {
      start,
      end,
      valueAt: (time) => {
        if (time <= start) return from;
        const position = motion.position(time - start);
        return numeric ? (position as unknown as T) : interpolator(from, target, position);
      },
      velocityAt: numeric ? (time) => motion.velocity(time - start) : () => 0,
    };

    this.drive(driver, clock);
    yield end;
    this.settle(driver, target);
  }

  private *keyframesRun(
    frames: Array<Keyframe<T> | T>,
    options: KeyframesOptions<T>,
  ): ThreadGenerator {
    // Built here, not when `keyframes()` was called: the start value is whatever the signal
    // holds now, which may have been changed by an animation that ran before this one.
    const track = new Keyframes(frames, {
      colorSpace: this._colorSpace,
      from: this.value(),
      ...options,
    });

    if (track.duration <= 0) {
      this.jump(track.valueAt(0));
      return;
    }

    const clock = requireClock();
    const start = clock.time;
    const end = start + track.duration;
    const numeric = typeof track.valueAt(0) === "number";

    const valueAt = (time: number): T => track.valueAt(time - start);
    const driver: Driver<T> = {
      start,
      end,
      valueAt,
      velocityAt: numeric
        ? (time) => slopeAt(valueAt as unknown as (t: number) => number, start, end, time)
        : () => 0,
    };

    this.drive(driver, clock);
    yield end;
    this.settle(driver, track.valueAt(track.duration));
  }

  private *waitRun(duration: number): ThreadGenerator {
    if (duration <= 0) return;
    yield requireClock().time + duration;
  }

  /**
   * Run animation from generator
   */
  public run(generator: ThreadGenerator): this {
    this._currentThread = generator;
    return this;
  }

  /**
   * Steps the animation given to {@link Signal.run} by hand: `delta` seconds go by, and it runs if it was due.
   * A `Scene` (or a `ThreadScheduler`) does this for you, for every animation at once.
   */
  public update(delta: number): boolean {
    const thread = this._currentThread;
    if (!thread) return false;

    const manual = (this._manual ??= { clock: createClock(1 / 240), wake: null, primed: false });
    manual.clock.time += delta;

    return withClock(manual.clock, () => {
      const due =
        !manual.primed || manual.wake === null || manual.wake <= manual.clock.time + TIME_EPS;
      if (!due) return true;

      const result = manual.primed ? thread.next(delta) : thread.next();
      manual.primed = true;
      if (result.done) {
        this._currentThread = null;
        this._manual = undefined;
        return false;
      }
      manual.wake = typeof result.value === "number" ? result.value : null;
      return true;
    });
  }

  /**
   * Check if signal has active animation
   */
  public isAnimating(): boolean {
    return this._currentThread !== null;
  }

  /** Solves a spring from where this signal is now. */
  private solve(target: T, config: SpringConfig | SpringPresetName) {
    const from = this.value();
    const numeric = typeof from === "number" && typeof target === "number";
    const interpolator = this._getInterpolator(from, target);
    const motion = numeric
      ? solveSpring(from as number, target as number, config, this.velocity())
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

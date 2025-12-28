import { getInterpolator, Interpolator, lerpColorHSL, lerpColorRGB } from "./Interpolation";

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
  easeOut: (t: number) => 1 - Math.pow(1 - t, 2),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  // Quartic
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),

  // Quintic
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t: number) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,

  // Sine
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential
  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // Circular
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  easeOutCirc: (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: (t: number) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
      : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  // Back
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // Bounce
  easeInBounce: (t: number) => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInOutBounce: (t: number) =>
    t < 0.5 ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2 : (1 + Easing.easeOutBounce(2 * t - 1)) / 2,
};

/**
 * Thread generator type - the core of animation system
 */
export type ThreadGenerator = Generator<void | number, void, number | void>;

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
  private _currentThread: ThreadGenerator | null = null;
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
   * Set value directly
   */
  public set(value: T): void {
    this._value = value;
    this._currentThread = null;
  }

  /**
   * Reset to initial value
   */
  public reset(): void {
    this._value = this._initialValue;
    this._currentThread = null;
  }

  /**
   * Animate to a new value - returns a generator
   */
  public *to(
    value: T,
    duration: number,
    config?: Partial<TweenConfig<T>> & { easing?: EasingFunction },
  ): ThreadGenerator {
    const from = this._value;
    const easing = config?.easing || Easing.linear;
    const interpolator = config?.interpolator || this._getInterpolator(from, value);

    if (duration <= 0) {
      this._value = value;
      return;
    }

    let elapsed = 0;

    while (elapsed < duration) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60; // Default 60fps
      elapsed += actualDelta;

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      this._value = interpolator(from, value, easedProgress);

      // Critical: ensure we don't overshoot
      if (elapsed >= duration) {
        this._value = value;
        break;
      }
    }

    // Final value assignment
    this._value = value;
  }

  /**
   * Wait for a duration without changing value
   */
  public *wait(duration: number): ThreadGenerator {
    let elapsed = 0;

    while (elapsed < duration) {
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

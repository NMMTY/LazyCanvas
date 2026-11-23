import { LazyError } from "../utils/LazyUtil";
import { type Interpolator, pickInterpolator } from "./Interpolation";
import type { EasingFunction } from "./Signal";

/**
 * One value on a keyframe track. Give the time as `at` (seconds) or `offset` (a fraction of
 * the duration from `0` to `1`), not both.
 */
export interface Keyframe<T> {
  /** Time in seconds. */
  at?: number;
  /** Time as a fraction of the track's `duration`, from `0` to `1`. Needs `duration` in the options. */
  offset?: number;
  /** The value at that time. */
  value: T;
  /** Easing of the stretch that *starts* at this keyframe (as in CSS). Defaults to the track's `easing`. */
  easing?: EasingFunction;
}

/**
 * Options for a keyframe track.
 */
export interface KeyframesOptions<T> {
  /**
   * Length of the track in seconds. Needed for keyframes given as plain values or as
   * `offset`s. Otherwise it defaults to the time of the last keyframe; a longer duration
   * holds the last value until it ends.
   */
  duration?: number;
  /** Easing for every stretch that does not have its own. Defaults to linear. */
  easing?: EasingFunction;
  /** How to blend two values. By default it is chosen from the values. */
  interpolator?: Interpolator<T>;
  /** For colour strings: blend in `rgb` (the default) or `hsl`. */
  colorSpace?: "rgb" | "hsl";
  /**
   * The value before the first keyframe, used when the first keyframe is not at time `0`.
   * `signal.keyframes()` fills it in with the signal's current value.
   */
  from?: T;
}

interface Resolved<T> {
  time: number;
  value: T;
  easing?: EasingFunction;
}

/**
 * A value that changes through a list of keyframes: the same thing as a CSS `@keyframes`
 * rule or a GSAP keyframe array.
 *
 * It is a plain function of time: `valueAt(t)` has no state, so you can ask for any `t`
 * in any order. Use it directly, or run it on a signal with {@link Signal.keyframes}.
 *
 * @example
 * ```ts
 * const track = new Keyframes([
 *   { at: 0, value: 0 },
 *   { at: 0.4, value: 300, easing: Easing.easeOutCubic },
 *   { at: 1, value: 120 },
 * ]);
 * track.valueAt(0.2); // somewhere between 0 and 300
 * ```
 */
export class Keyframes<T = number> {
  /** Length of the track in seconds. */
  public readonly duration: number;

  private readonly frames: Resolved<T>[];
  private readonly easing: EasingFunction | undefined;
  private readonly options: KeyframesOptions<T>;

  /**
   * @param {Array<Keyframe<T> | T>} frames - Keyframes, or plain values that are spread evenly
   * over `options.duration`.
   * @param {KeyframesOptions<T>} [options] - Duration, easing and blending.
   * @throws {LazyError} If there are no keyframes, a time is missing, negative or beyond the
   * duration, or plain values are given without a `duration`.
   */
  constructor(frames: Array<Keyframe<T> | T>, options: KeyframesOptions<T> = {}) {
    if (frames.length === 0) throw new LazyError("Keyframes: at least one keyframe is needed");

    this.options = options;
    this.easing = options.easing;

    const resolved = this.resolve(frames, options);

    if (resolved[0].time > 0 && options.from !== undefined) {
      resolved.unshift({ time: 0, value: options.from });
    }

    const last = resolved[resolved.length - 1].time;
    const duration = options.duration ?? last;
    if (last > duration + 1e-9) {
      throw new LazyError(
        `Keyframes: a keyframe at ${last}s is after the duration of ${duration}s`,
      );
    }

    this.frames = resolved;
    this.duration = duration;
  }

  /**
   * The value `time` seconds into the track. Before the first keyframe it is the first value,
   * after the last it is the last value.
   */
  public valueAt(time: number): T {
    const frames = this.frames;
    if (time <= frames[0].time) return frames[0].value;
    const last = frames[frames.length - 1];
    if (time >= last.time) return last.value;

    // The last keyframe at or before `time`; keyframes sharing a time jump from the earlier to the later.
    let low = 0;
    let high = frames.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (frames[mid].time <= time) low = mid;
      else high = mid - 1;
    }

    const from = frames[low];
    const to = frames[low + 1];
    const progress = (time - from.time) / (to.time - from.time);
    const easing = from.easing ?? this.easing;
    const eased = easing ? easing(progress) : progress;
    return pickInterpolator(from.value, to.value, this.options)(from.value, to.value, eased);
  }

  private resolve(frames: Array<Keyframe<T> | T>, options: KeyframesOptions<T>): Resolved<T>[] {
    const isFrame = (frame: Keyframe<T> | T): frame is Keyframe<T> =>
      typeof frame === "object" &&
      frame !== null &&
      "value" in frame &&
      ("at" in frame || "offset" in frame);

    const plain = frames.filter((frame) => !isFrame(frame)).length;
    if (plain > 0 && plain < frames.length) {
      throw new LazyError(
        "Keyframes: use either plain values or { at | offset, value } objects, not both",
      );
    }

    if (plain === frames.length) {
      if (options.duration === undefined) {
        throw new LazyError("Keyframes: plain values need `duration` in the options");
      }
      const count = frames.length;
      return (frames as T[]).map((value, index) => ({
        time: count === 1 ? 0 : (index / (count - 1)) * options.duration!,
        value,
      }));
    }

    const resolved = (frames as Keyframe<T>[]).map((frame, index) => {
      const hasAt = frame.at !== undefined;
      const hasOffset = frame.offset !== undefined;
      if (hasAt === hasOffset) {
        throw new LazyError(
          `Keyframes: keyframe ${index} needs exactly one of \`at\` and \`offset\``,
        );
      }

      let time: number;
      if (hasAt) {
        time = frame.at as number;
      } else {
        if (options.duration === undefined) {
          throw new LazyError("Keyframes: `offset` needs `duration` in the options");
        }
        time = (frame.offset as number) * options.duration;
      }
      if (!Number.isFinite(time) || time < 0) {
        throw new LazyError(`Keyframes: keyframe ${index} has an invalid time (${time})`);
      }
      return { time, value: frame.value, easing: frame.easing };
    });

    // Stable sort: keyframes at the same time keep the order they were written in.
    return resolved
      .map((frame, index) => ({ frame, index }))
      .sort((a, b) => a.frame.time - b.frame.time || a.index - b.index)
      .map(({ frame }) => frame);
  }
}

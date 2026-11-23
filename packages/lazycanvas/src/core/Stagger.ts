import { LazyError } from "../utils/LazyUtil";
import { durationOf, withDuration } from "./Duration";
import type { EasingFunction, ThreadGenerator } from "./Signal";
import { all, delay } from "./SignalUtils";

/**
 * Where a stagger starts from: the first item, the last, the middle, both ends, a random order,
 * or the item at an index.
 */
export type StaggerFrom = "start" | "end" | "center" | "edges" | "random" | number;

/**
 * How a stagger spaces its items in time.
 */
export interface StaggerOptions {
  /**
   * Seconds between one item and the next. With `from: "center"` it is the gap between rings: the
   * two items next to the centre start together, the next two `each` later, and so on.
   */
  each?: number;
  /** Seconds from the first item starting to the last one starting. Use it instead of `each`. */
  total?: number;
  /** Which item goes first. Defaults to `"start"`. */
  from?: StaggerFrom;
  /**
   * Reshapes the spacing: it is applied to how far along the order an item is (`0` for the first
   * to start, `1` for the last). `Easing.easeIn`, for instance, makes the starts bunch up at the
   * beginning and spread out at the end.
   */
  ease?: EasingFunction;
  /** Seed for `from: "random"`, so the same order comes out every time. Defaults to `1`. */
  seed?: number;
}

/** A small seeded random number generator (mulberry32), so a "random" order is repeatable. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * When each of `count` items starts, in seconds from the start of the stagger.
 *
 * @param {number} count - The number of items.
 * @param {number | StaggerOptions} options - `each` as a number, or the full options.
 * @returns {number[]} One delay per item, in the order of the items.
 * @throws {LazyError} If neither `each` nor `total` is given, a number is negative, or the
 * starting index is out of range.
 */
export function staggerDelays(count: number, options: number | StaggerOptions): number[] {
  const config: StaggerOptions = typeof options === "number" ? { each: options } : options;
  if (config.each === undefined && config.total === undefined) {
    throw new LazyError("stagger: give `each` (a gap) or `total` (the whole spread) in seconds");
  }
  if ((config.each ?? 0) < 0 || (config.total ?? 0) < 0) {
    throw new LazyError("stagger: `each` and `total` cannot be negative");
  }
  if (count === 0) return [];

  const from = config.from ?? "start";
  const last = count - 1;

  // How many steps from the start of the order each item is.
  let steps: number[];
  if (typeof from === "number") {
    if (!Number.isInteger(from) || from < 0 || from > last) {
      throw new LazyError(`stagger: \`from\` index ${from} is outside 0..${last}`);
    }
    steps = Array.from({ length: count }, (_, i) => Math.abs(i - from));
  } else if (from === "start") {
    steps = Array.from({ length: count }, (_, i) => i);
  } else if (from === "end") {
    steps = Array.from({ length: count }, (_, i) => last - i);
  } else if (from === "center") {
    steps = Array.from({ length: count }, (_, i) => Math.abs(i - last / 2));
  } else if (from === "edges") {
    steps = Array.from({ length: count }, (_, i) => Math.min(i, last - i));
  } else if (from === "random") {
    const random = seededRandom(config.seed ?? 1);
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = last; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    steps = order;
  } else {
    throw new LazyError(`stagger: unknown \`from\` "${String(from)}"`);
  }

  const maxSteps = Math.max(...steps);
  const total = config.total ?? (config.each ?? 0) * maxSteps;
  return steps.map((step) => {
    const progress = maxSteps > 0 ? step / maxSteps : 0;
    return total * (config.ease ? config.ease(progress) : progress);
  });
}

/**
 * Runs animations side by side, each one starting a little after the one before it.
 *
 * Give it the animations, or a list of things and a function that makes an animation for each.
 *
 * @param {number | StaggerOptions} options - Seconds between starts, or the full options.
 * @param {ThreadGenerator[]} animations - The animations, in order.
 * @returns {ThreadGenerator} An animation that ends when the last one does.
 *
 * @example
 * ```ts
 * yield* stagger(0.08, bars.map((h) => h.to(200, 0.5)));
 * yield* stagger({ each: 0.05, from: "center" }, dots, (opacity) => opacity.to(1, 0.3));
 * ```
 */
export function stagger(
  options: number | StaggerOptions,
  animations: ThreadGenerator[],
): ThreadGenerator;
export function stagger<T>(
  options: number | StaggerOptions,
  items: T[],
  animate: (item: T, index: number) => ThreadGenerator,
): ThreadGenerator;
export function stagger<T>(
  options: number | StaggerOptions,
  source: Array<T | ThreadGenerator>,
  animate?: (item: T, index: number) => ThreadGenerator,
): ThreadGenerator {
  const animations = animate
    ? (source as T[]).map((item, index) => animate(item, index))
    : (source as ThreadGenerator[]);
  const delays = staggerDelays(animations.length, options);

  let end: number | undefined = 0;
  const delayed = animations.map((animation, index) => {
    const length = durationOf(animation);
    end =
      end === undefined || length === undefined ? undefined : Math.max(end, delays[index] + length);
    return delay(delays[index], animation);
  });

  const run = all(...delayed);
  return end === undefined ? run : withDuration(run, end);
}

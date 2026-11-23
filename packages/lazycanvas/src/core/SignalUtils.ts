import { LazyError } from "../utils/LazyUtil";
import { type Clock, TIME_EPS, requireClock, wakeOf } from "./Clock";
import { durationOf, withDuration } from "./Duration";
import type { Signal, ThreadGenerator } from "./Signal";
import type { SpringConfig, SpringPresetName } from "./Spring";
import { ThreadScheduler } from "./ThreadScheduler";

/** Sum of the lengths, or `undefined` if one of them is not known. */
function totalOf(animations: object[]): number | undefined {
  let total = 0;
  for (const animation of animations) {
    const length = durationOf(animation);
    if (length === undefined) return undefined;
    total += length;
  }
  return total;
}

/** Longest of the lengths, or `undefined` if one of them is not known. */
function longestOf(animations: object[]): number | undefined {
  let longest = 0;
  for (const animation of animations) {
    const length = durationOf(animation);
    if (length === undefined) return undefined;
    longest = Math.max(longest, length);
  }
  return longest;
}

/** Tags an animation with its length when that is known. */
function tagged<T extends object>(animation: T, length: number | undefined): T {
  return length === undefined ? animation : withDuration(animation, length);
}

/**
 * A thread of an animation: what the signals it animates are told when it is stopped.
 * @internal
 */
interface Thread {
  /** The thread (or the animation) this one belongs to. */
  parent: unknown;
}

/**
 * Animations running side by side, each asleep until it is due.
 *
 * It is what `all`, `any`, `loopFor` and `timeline` are made of. Each animation has its own thread of
 * ownership: the animations it installs on signals are marked as its own, so that if it is stopped
 * (because another one finished first, or time ran out) the signals stay where they were.
 */
class Concurrent<Tag = undefined> {
  private children: Array<{
    gen: ThreadGenerator;
    wake: number | null;
    last: number;
    thread: Thread;
    tag: Tag | undefined;
  }> = [];

  constructor(
    private readonly clock: Clock,
    private readonly onFinish?: (tag: Tag | undefined) => void,
  ) {}

  get size(): number {
    return this.children.length;
  }

  /** Starts an animation: runs it to its first `yield`, now. */
  start(gen: ThreadGenerator, tag?: Tag): void {
    const thread: Thread = { parent: this.clock.owner };
    const result = this.resume(thread, () => gen.next());
    if (result.done) {
      this.onFinish?.(tag);
    } else {
      this.children.push({ gen, wake: wakeOf(result.value), last: this.clock.time, thread, tag });
    }
  }

  /** The time the next of them is due: a time it asked for, or a step of the grid for one that is polled. */
  nextWake(): number {
    let next = Number.POSITIVE_INFINITY;
    for (const child of this.children) {
      const due = child.wake === null ? this.clock.nextGrid(this.clock.time) : child.wake;
      if (due < next) next = due;
    }
    return next;
  }

  /** Resumes what is due now. */
  advance(): void {
    const now = this.clock.time;
    for (let i = 0; i < this.children.length; ) {
      const child = this.children[i];
      const due =
        child.wake === null
          ? this.clock.onGrid(now) && now > child.last + TIME_EPS
          : child.wake <= now + TIME_EPS;
      if (!due) {
        i++;
        continue;
      }

      const delta = now - child.last;
      child.last = now;
      const result = this.resume(child.thread, () => child.gen.next(delta));
      if (result.done) {
        this.children.splice(i, 1);
        this.onFinish?.(child.tag);
      } else {
        child.wake = wakeOf(result.value);
        i++;
      }
    }
  }

  /** Stops what is left. What it was animating stays where it is. */
  cancel(): void {
    for (const child of this.children) {
      for (const signal of [...this.clock.driven]) {
        if (signal.drivenBy(child.thread)) signal.freeze();
      }
    }
    this.children = [];
  }

  private resume<R>(thread: Thread, run: () => R): R {
    const previous = this.clock.owner;
    this.clock.owner = thread;
    try {
      return run();
    } finally {
      this.clock.owner = previous;
    }
  }
}

/**
 * Run multiple animations in parallel
 * @param generators - Array of animation generators
 */
export function all(...generators: ThreadGenerator[]): ThreadGenerator {
  return tagged(runAll(generators), longestOf(generators));
}

function* runAll(generators: ThreadGenerator[]): ThreadGenerator {
  const group = new Concurrent(requireClock());
  for (const generator of generators) group.start(generator);

  while (group.size > 0) {
    yield group.nextWake();
    group.advance();
  }
}

/**
 * Run animations in sequence
 * @param generators - Array of animation generators
 */
export function chain(...generators: ThreadGenerator[]): ThreadGenerator {
  return tagged(runChain(generators), totalOf(generators));
}

function* runChain(generators: ThreadGenerator[]): ThreadGenerator {
  for (const generator of generators) {
    yield* generator;
  }
}

/**
 * Run animation in a loop
 * @param generator - Animation generator factory
 * @param times - Number of iterations (Infinity for endless)
 */
export function* loop(
  generator: () => ThreadGenerator,
  times: number = Number.POSITIVE_INFINITY,
): ThreadGenerator {
  let count = 0;

  while (count < times) {
    yield* generator();
    count++;
  }
}

/**
 * Run animation for a specific duration
 * @param generator - Animation generator factory
 * @param duration - Total duration in seconds
 */
export function loopFor(generator: () => ThreadGenerator, duration: number): ThreadGenerator {
  return withDuration(runLoopFor(generator, duration), duration);
}

function* runLoopFor(generator: () => ThreadGenerator, duration: number): ThreadGenerator {
  const clock = requireClock();
  const end = clock.time + duration;
  let withoutTime = 0;

  while (clock.time < end - TIME_EPS) {
    const began = clock.time;
    const group = new Concurrent(clock);
    group.start(generator());

    while (group.size > 0) {
      yield Math.min(group.nextWake(), end);
      if (clock.time >= end - TIME_EPS) {
        group.cancel();
        return;
      }
      group.advance();
    }

    // The body ended and, if it took no time at all, the loop would never get to the end.
    if (clock.time === began && ++withoutTime > 1000) {
      throw new LazyError("loopFor: the animation takes no time, so the loop would never end");
    }
  }
}

/**
 * Wait for a specific duration
 * @param duration - Duration in seconds
 */
export function waitFor(duration: number): ThreadGenerator {
  return withDuration(runWaitFor(duration), Math.max(duration, 0));
}

function* runWaitFor(duration: number): ThreadGenerator {
  if (duration <= 0) return;
  yield requireClock().time + duration;
}

/**
 * Delay an animation by a specific duration
 * @param duration - Delay in seconds
 * @param generator - Animation generator
 */
export function delay(duration: number, generator: ThreadGenerator): ThreadGenerator {
  return tagged(runDelay(duration, generator), totalOf([waitFor(duration), generator]));
}

function* runDelay(duration: number, generator: ThreadGenerator): ThreadGenerator {
  yield* waitFor(duration);
  yield* generator;
}

/**
 * Run animations until any one completes
 * @param generators - Array of animation generators
 */
export function* any(...generators: ThreadGenerator[]): ThreadGenerator {
  const clock = requireClock();
  let finished = false;
  const group = new Concurrent(clock, () => {
    finished = true;
  });

  for (const generator of generators) {
    group.start(generator);
    if (finished) break;
  }

  while (!finished && group.size > 0) {
    yield group.nextWake();
    group.advance();
  }

  // Cancel all other generators
  group.cancel();
}

/**
 * Conditional animation
 * @param condition - Condition function
 * @param trueGen - Generator if condition is true
 * @param falseGen - Generator if condition is false
 */
export function* conditional(
  condition: () => boolean,
  trueGen: ThreadGenerator,
  falseGen?: ThreadGenerator,
): ThreadGenerator {
  if (condition()) {
    yield* trueGen;
  } else if (falseGen) {
    yield* falseGen;
  }
}

/**
 * Repeat animation while condition is true
 * @param condition - Condition function
 * @param generator - Animation generator factory
 */
export function* repeatWhile(
  condition: () => boolean,
  generator: () => ThreadGenerator,
): ThreadGenerator {
  while (condition()) {
    yield* generator();
  }
}

/**
 * Run animation at specific intervals
 * @param interval - Interval duration in seconds
 * @param generator - Animation generator factory
 * @param times - Number of times to run (Infinity for endless)
 */
export function* every(
  interval: number,
  generator: () => ThreadGenerator,
  times: number = Number.POSITIVE_INFINITY,
): ThreadGenerator {
  let count = 0;

  while (count < times) {
    yield* generator();
    yield* waitFor(interval);
    count++;
  }
}

/**
 * Spring animation utility. The same as `signal.spring(target, config)`.
 *
 * @param signal - Signal to animate
 * @param target - Target value
 * @param config - Spring configuration (`precision` sets both `restDelta` and `restSpeed`)
 */
export function spring<T>(
  signal: Signal<T>,
  target: T,
  config: SpringConfig & { precision?: number } = {},
): ThreadGenerator {
  const { precision, ...rest } = config;
  const resolved: SpringConfig =
    precision === undefined ? rest : { restDelta: precision, restSpeed: precision, ...rest };
  return signal.spring(target, resolved as SpringConfig | SpringPresetName);
}

/**
 * Tween between multiple values in sequence
 * @param signal - Signal to animate
 * @param values - Array of target values
 * @param duration - Duration for each tween
 * @param config - Tween configuration
 */
export function sequence<T>(
  signal: Signal<T>,
  values: T[],
  duration: number,
  config?: Parameters<Signal<T>["to"]>[2],
): ThreadGenerator {
  return withDuration(runSequence(signal, values, duration, config), values.length * duration);
}

function* runSequence<T>(
  signal: Signal<T>,
  values: T[],
  duration: number,
  config?: Parameters<Signal<T>["to"]>[2],
): ThreadGenerator {
  for (const value of values) {
    yield* signal.to(value, duration, config);
  }
}

/**
 * Animate signal back and forth
 * @param signal - Signal to animate
 * @param from - Start value
 * @param to - End value
 * @param duration - Duration for each direction
 * @param config - Tween configuration
 */
export function yoyo<T>(
  signal: Signal<T>,
  from: T,
  to: T,
  duration: number,
  config?: Parameters<Signal<T>["to"]>[2],
): ThreadGenerator {
  return withDuration(runYoyo(signal, from, to, duration, config), duration * 2);
}

function* runYoyo<T>(
  signal: Signal<T>,
  from: T,
  to: T,
  duration: number,
  config?: Parameters<Signal<T>["to"]>[2],
): ThreadGenerator {
  signal.set(from);
  yield* signal.to(to, duration, config);
  yield* signal.to(from, duration, config);
}

/**
 * A timeline entry: an animation and when it starts.
 */
interface TimelineEntry {
  /** Absolute start time in seconds, or `null` to start when the previous entry finishes. */
  at: number | null;
  generator: ThreadGenerator;
  /** Where it starts, if that is known before playing. */
  start: number | undefined;
  /** Where it ends, if that is known before playing. */
  end: number | undefined;
}

/**
 * Places animations on a shared clock: side by side, one after another, or at a label.
 *
 * Positions work like GSAP's. The second argument of {@link Timeline.add} is
 *
 * - a number: seconds from the start of the timeline,
 * - `"<"`: where the previous animation starts, `">"`: where it ends,
 * - `"+=0.5"` / `"-=0.5"`: half a second after / before the end of the timeline,
 * - `"<0.2"`-style offsets: `"<+=0.2"`, `">-=0.1"`, `"intro+=0.3"` (after a label),
 * - left out: at the end of the timeline.
 *
 * Positions that depend on an end need the length of what came before. The animations
 * LazyCanvas makes (`to`, `spring`, `keyframes`, `waitFor`, `all`, `chain`, nested timelines)
 * know it; for a generator you wrote yourself use an absolute position or {@link Timeline.after}.
 * A spring counts as the time it takes to settle from where it is when it is created.
 *
 * @example
 * ```ts
 * const tl = timeline()
 *   .add(x.to(300, 1))              // 0 – 1
 *   .add(opacity.to(1, 0.5), "<")   // together with it
 *   .add(y.spring(80), ">-=0.2")    // 0.2 s before x ends
 *   .label("end")
 *   .add(color.to("#f00", 0.4), "end+=0.5");
 * scene.addAnimation(tl.play());
 * ```
 */
export class Timeline {
  private entries: TimelineEntry[] = [];
  private labels = new Map<string, number>();
  private cursor: number | null = null;

  /**
   * Adds an animation, or a nested timeline, at a position.
   *
   * @param {ThreadGenerator | Timeline} animation - What to run.
   * @param {number | string} [position] - Where it starts. See the class description.
   * @throws {LazyError} If the position uses an end that is not known, a label that does not exist,
   * or is before `0`.
   */
  public add(animation: ThreadGenerator | Timeline, position?: number | string): this {
    const generator = animation instanceof Timeline ? animation.play() : animation;
    const start = this.resolvePosition(position);
    const length = durationOf(generator);
    this.entries.push({
      at: start,
      generator,
      start,
      end: length === undefined ? undefined : start + length,
    });
    return this;
  }

  /**
   * Add animation at specific time
   */
  public at(time: number, generator: ThreadGenerator): this {
    return this.add(generator, time);
  }

  /**
   * Add an animation that starts when the previously added one finishes.
   *
   * Unlike a position this waits for the real end, so it works for any generator, including
   * ones of unknown length. The first animation added this way starts at time `0`. After
   * {@link Timeline.seek} the next one starts at that time instead.
   *
   * Named `after` rather than `then` on purpose: a `then` method would make
   * Timeline thenable, so `await timeline()` would try to resolve the timeline
   * as a promise instead of returning it.
   */
  public after(generator: ThreadGenerator): this {
    const length = durationOf(generator);
    let at: number | null;
    let start: number | undefined;

    if (this.cursor !== null) {
      at = start = this.cursor;
      this.cursor = null;
    } else if (this.entries.length === 0) {
      at = start = 0;
    } else {
      at = null;
      start = this.entries[this.entries.length - 1].end;
    }

    this.entries.push({
      at,
      generator,
      start,
      end: start === undefined || length === undefined ? undefined : start + length,
    });
    return this;
  }

  /**
   * Make the next {@link Timeline.after} start at an absolute time, instead of
   * waiting for the previous animation.
   */
  public seek(time: number): this {
    this.cursor = time;
    return this;
  }

  /**
   * Names a time, so later animations can be placed relative to it (`"name+=0.5"`).
   *
   * @param {string} name - The label.
   * @param {number | string} [position] - Where it is. Defaults to the end of the timeline.
   */
  public label(name: string, position?: number | string): this {
    this.labels.set(name, this.resolvePosition(position));
    return this;
  }

  /**
   * Length of the timeline in seconds, or `undefined` if an animation on it has an unknown length.
   */
  public get duration(): number | undefined {
    let end = 0;
    for (const entry of this.entries) {
      if (entry.end === undefined) return undefined;
      end = Math.max(end, entry.end);
    }
    return end;
  }

  /**
   * Execute timeline
   */
  public play(): ThreadGenerator {
    return tagged(this.run(), this.duration);
  }

  private resolvePosition(position?: number | string): number {
    if (typeof position === "number") {
      if (!Number.isFinite(position) || position < 0) {
        throw new LazyError(`Timeline: position ${position} is not a time of 0 or more`);
      }
      return position;
    }

    // Nothing given: the end of the timeline.
    let base: string | undefined;
    let sign: string | undefined;
    let amount: string | undefined;
    if (position !== undefined) {
      const match = /^(<|>|[A-Za-z_][\w-]*)?(?:([+-])=(\d+(?:\.\d+)?))?$/.exec(position);
      if (match === null) {
        throw new LazyError(`Timeline: cannot read the position "${position}"`);
      }
      [, base, sign, amount] = match;
    }

    const offset = amount === undefined ? 0 : (sign === "-" ? -1 : 1) * Number(amount);
    const last = this.entries[this.entries.length - 1];

    let origin: number | undefined;
    if (base === "<" || base === ">") {
      if (!last) throw new LazyError(`Timeline: "${base}" needs an animation before it`);
      origin = base === "<" ? last.start : last.end;
      if (origin === undefined) {
        throw new LazyError(
          `Timeline: "${position}" depends on an animation of unknown length. Give an absolute position, or use after().`,
        );
      }
    } else if (base !== undefined) {
      const labelled = this.labels.get(base);
      if (labelled === undefined) throw new LazyError(`Timeline: there is no label "${base}"`);
      origin = labelled;
    } else {
      origin = this.duration;
      if (origin === undefined) {
        throw new LazyError(
          "Timeline: cannot add at the end because an animation on it has an unknown length. " +
            "Give an absolute position, or use after().",
        );
      }
    }

    const time = origin + offset;
    if (time < 0) {
      throw new LazyError(`Timeline: position "${position}" is before the start of the timeline`);
    }
    return time;
  }

  private *run(): ThreadGenerator {
    const clock = requireClock();
    const origin = clock.time;
    const entries = this.entries;
    const started: boolean[] = entries.map(() => false);

    // An entry that follows the previous one starts the moment that one ends.
    const group = new Concurrent<number>(clock, (index) => {
      const next = (index as number) + 1;
      if (next < entries.length && entries[next].at === null && !started[next]) begin(next);
    });

    const begin = (index: number) => {
      started[index] = true;
      group.start(entries[index].generator, index);
    };

    const startDue = () => {
      for (let i = 0; i < entries.length; i++) {
        const at = entries[i].at;
        if (!started[i] && at !== null && clock.time >= origin + at - TIME_EPS) begin(i);
      }
    };

    startDue();

    while (started.includes(false) || group.size > 0) {
      // Asleep until what is running is due, or until the next entry is to start.
      let next = group.nextWake();
      for (let i = 0; i < entries.length; i++) {
        const at = entries[i].at;
        if (!started[i] && at !== null) next = Math.min(next, origin + at);
      }
      if (!Number.isFinite(next)) break;

      yield next;
      // What is already running goes first: an animation that starts now begins at this moment.
      group.advance();
      startDue();
    }
  }
}

/**
 * Create a timeline
 */
export function timeline(): Timeline {
  return new Timeline();
}

/**
 * Calculate the total duration of an animation by running it to its end
 * @param generatorFactory - Function that creates the animation generator
 * @param maxDuration - Maximum duration to simulate (safety limit, default: 3600s = 1 hour)
 * @param timestep - The grid, in seconds, that a generator that is polled runs on (default: 1/240)
 * @returns Total duration in seconds
 */
export function calculateDuration(
  generatorFactory: () => ThreadGenerator,
  maxDuration = 3600,
  timestep?: number,
): number {
  // The animation runs the way it does in a scene, on a scheduler of its own that is thrown away afterwards.
  // What it animates is left where it ended up.
  const scheduler = new ThreadScheduler({ history: false, step: timestep });
  scheduler.add(generatorFactory());
  const duration = scheduler.runToEnd(maxDuration);

  if (scheduler.hasActiveThreads()) {
    console.warn(
      `Animation duration calculation reached maximum limit of ${maxDuration}s. Animation may be infinite or very long.`,
    );
  }

  return duration;
}

/**
 * Calculate duration from multiple animation factories running in parallel
 * Returns the duration of the longest animation
 */
export function calculateParallelDuration(
  generatorFactories: (() => ThreadGenerator)[],
  maxDuration = 3600,
  timestep?: number,
): number {
  const durations = generatorFactories.map((factory) =>
    calculateDuration(factory, maxDuration, timestep),
  );
  return Math.max(...durations);
}

/**
 * Calculate duration from multiple animation factories running in sequence
 * Returns the sum of all animation durations
 */
export function calculateSequentialDuration(
  generatorFactories: (() => ThreadGenerator)[],
  maxDuration = 3600,
  timestep?: number,
): number {
  let totalDuration = 0;

  for (const factory of generatorFactories) {
    const duration = calculateDuration(factory, maxDuration - totalDuration, timestep);
    totalDuration += duration;

    if (totalDuration >= maxDuration) {
      console.warn(
        `Sequential animation duration calculation reached maximum limit of ${maxDuration}s.`,
      );
      break;
    }
  }

  return totalDuration;
}

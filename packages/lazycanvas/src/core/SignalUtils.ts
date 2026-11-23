import { type Signal, type ThreadGenerator, timeReached } from "./Signal";

/**
 * Metadata for tracking animation duration
 */
interface AnimationMetadata {
  duration: number;
}

/**
 * Storage for animation duration metadata
 */
const animationDurations = new WeakMap<any, number>();

/**
 * Run multiple animations in parallel
 * @param generators - Array of animation generators
 */
export function* all(...generators: ThreadGenerator[]): ThreadGenerator {
  const active = [...generators];

  // Initialize all generators before starting
  for (const gen of active) {
    gen.next(); // Prime the generator
  }

  while (active.length > 0) {
    const delta = yield;

    for (let i = active.length - 1; i >= 0; i--) {
      const result = active[i].next(delta);
      if (result.done) {
        active.splice(i, 1);
      }
    }
  }
}

/**
 * Run animations in sequence
 * @param generators - Array of animation generators
 */
export function* chain(...generators: ThreadGenerator[]): ThreadGenerator {
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
export function* loopFor(generator: () => ThreadGenerator, duration: number): ThreadGenerator {
  let elapsed = 0;

  while (!timeReached(elapsed, duration)) {
    const gen = generator();

    let result = gen.next();
    while (!result.done && !timeReached(elapsed, duration)) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60;
      elapsed += actualDelta;
      result = gen.next(delta);
    }

    // If animation finished before duration, restart
    if (result.done && !timeReached(elapsed, duration)) {
      // Loop continues
    } else {
      break;
    }
  }
}

/**
 * Wait for a specific duration
 * @param duration - Duration in seconds
 */
export function* waitFor(duration: number): ThreadGenerator {
  let elapsed = 0;

  while (!timeReached(elapsed, duration)) {
    const delta = yield;
    const actualDelta = typeof delta === "number" ? delta : 1 / 60;
    elapsed += actualDelta;
  }
}

/**
 * Delay an animation by a specific duration
 * @param duration - Delay in seconds
 * @param generator - Animation generator
 */
export function* delay(duration: number, generator: ThreadGenerator): ThreadGenerator {
  yield* waitFor(duration);
  yield* generator;
}

/**
 * Run animations until any one completes
 * @param generators - Array of animation generators
 */
export function* any(...generators: ThreadGenerator[]): ThreadGenerator {
  const active = [...generators];

  while (active.length > 0) {
    const delta = yield;

    for (const gen of active) {
      const result = gen.next(delta);
      if (result.done) {
        // Cancel all other generators
        return;
      }
    }
  }
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
 * Spring animation utility
 * @param signal - Signal to animate
 * @param target - Target value
 * @param config - Spring configuration
 */
export function* spring<T>(
  signal: Signal<T>,
  target: T,
  config: {
    stiffness?: number;
    damping?: number;
    mass?: number;
    precision?: number;
  } = {},
): ThreadGenerator {
  const stiffness = config.stiffness ?? 170;
  const damping = config.damping ?? 26;
  const mass = config.mass ?? 1;
  const precision = config.precision ?? 0.01;

  // Only works for numbers
  if (typeof signal.value() !== "number" || typeof target !== "number") {
    signal.set(target);
    return;
  }

  let position = signal.value() as unknown as number;
  let velocity = 0;
  const targetNum = target as unknown as number;

  while (Math.abs(position - targetNum) > precision || Math.abs(velocity) > precision) {
    const delta = yield;
    const actualDelta = typeof delta === "number" ? delta : 1 / 60;

    const force = -stiffness * (position - targetNum);
    const dampingForce = -damping * velocity;
    const acceleration = (force + dampingForce) / mass;

    velocity += acceleration * actualDelta;
    position += velocity * actualDelta;

    signal.set(position as unknown as T);
  }

  signal.set(target);
}

/**
 * Tween between multiple values in sequence
 * @param signal - Signal to animate
 * @param values - Array of target values
 * @param duration - Duration for each tween
 * @param config - Tween configuration
 */
export function* sequence<T>(
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
export function* yoyo<T>(
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
}

/**
 * Create a timeline builder for complex animations
 */
export class Timeline {
  private entries: TimelineEntry[] = [];
  private cursor: number | null = null;

  /**
   * Add animation at specific time
   */
  public at(time: number, generator: ThreadGenerator): this {
    this.entries.push({ at: time, generator });
    return this;
  }

  /**
   * Add an animation that starts when the previously added one finishes.
   *
   * The first animation added this way starts at time `0`. After {@link Timeline.seek}
   * the next one starts at that time instead.
   *
   * Named `after` rather than `then` on purpose: a `then` method would make
   * Timeline thenable, so `await timeline()` would try to resolve the timeline
   * as a promise instead of returning it.
   */
  public after(generator: ThreadGenerator): this {
    if (this.cursor !== null) {
      this.entries.push({ at: this.cursor, generator });
      this.cursor = null;
    } else if (this.entries.length === 0) {
      this.entries.push({ at: 0, generator });
    } else {
      this.entries.push({ at: null, generator });
    }
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
   * Execute timeline
   */
  public *play(): ThreadGenerator {
    const entries = this.entries;
    const started: boolean[] = entries.map(() => false);
    const active = new Map<number, ThreadGenerator>();
    let time = 0;

    const start = (index: number) => {
      started[index] = true;
      const generator = entries[index].generator;
      if (!generator.next().done) active.set(index, generator);
      else finish(index);
    };

    // An entry that follows the previous one starts the moment that one ends.
    const finish = (index: number) => {
      const next = index + 1;
      if (next < entries.length && entries[next].at === null && !started[next]) start(next);
    };

    const startDue = () => {
      for (let i = 0; i < entries.length; i++) {
        const at = entries[i].at;
        if (!started[i] && at !== null && timeReached(time, at)) start(i);
      }
    };

    startDue();

    while (started.includes(false) || active.size > 0) {
      const delta = yield;
      const actualDelta = typeof delta === "number" ? delta : 1 / 60;
      time += actualDelta;

      // Advance what is already running first: an animation that starts now begins at
      // this moment, so it must not take a step before the next one.
      for (const [index, generator] of [...active]) {
        if (generator.next(delta).done) {
          active.delete(index);
          finish(index);
        }
      }

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
 * Calculate the total duration of an animation by running it with a fixed timestep
 * @param generatorFactory - Function that creates the animation generator
 * @param maxDuration - Maximum duration to simulate (safety limit, default: 3600s = 1 hour)
 * @param timestep - Simulation timestep in seconds (default: 1/60)
 * @returns Total duration in seconds
 */
export function calculateDuration(
  generatorFactory: () => ThreadGenerator,
  maxDuration = 3600,
  timestep: number = 1 / 60,
): number {
  const gen = generatorFactory();
  let totalTime = 0;

  // Initialize generator
  gen.next();

  // Run generator until completion
  let result = gen.next(timestep);
  while (!result.done && totalTime < maxDuration) {
    totalTime += timestep;
    result = gen.next(timestep);
  }

  if (totalTime >= maxDuration) {
    console.warn(
      `Animation duration calculation reached maximum limit of ${maxDuration}s. Animation may be infinite or very long.`,
    );
  }

  return totalTime;
}

/**
 * Calculate duration from multiple animation factories running in parallel
 * Returns the duration of the longest animation
 */
export function calculateParallelDuration(
  generatorFactories: (() => ThreadGenerator)[],
  maxDuration = 3600,
  timestep: number = 1 / 60,
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
  timestep: number = 1 / 60,
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

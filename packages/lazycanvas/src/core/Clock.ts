/**
 * The time animations run on.
 *
 * A {@link ThreadScheduler} owns a clock and advances it from event to event: the moment an animation ends,
 * the moment another is due to start, or a step of the grid for animations that ask to be polled. While it
 * resumes an animation the clock is the *active* one, which is how `signal.to()` and `waitFor()` know what time
 * it is without being told.
 */
export interface Clock {
  /** The current time, in seconds. */
  time: number;
  /** Length of one step of the grid that animations that are polled run on, in seconds. */
  readonly step: number;
  /** The first point of the grid after `time`. */
  nextGrid(time: number): number;
  /** Whether `time` is a point of the grid. */
  onGrid(time: number): boolean;
  /**
   * Signals that have an animation installed on them by this clock, so that stopping the animations can leave them
   * where they were.
   * @internal
   */
  driven: Set<{ freeze(): void; drivenBy(owner: unknown): boolean }>;
  /** The thread being resumed, so that what it installs can be told from what another thread installs. @internal */
  owner: unknown;
}

/** Tolerance when comparing times: they are sums of floating point numbers. */
export const TIME_EPS = 1e-9;

let active: Clock | null = null;

/** The clock of the scheduler that is resuming an animation right now, if there is one. */
export function currentClock(): Clock | null {
  return active;
}

/**
 * The active clock.
 * @throws {Error} If no scheduler is running the animation: `signal.to()` and the other animations are
 * generators for a `Scene` (`scene.addAnimation`) or a `ThreadScheduler` to run.
 */
export function requireClock(): Clock {
  if (active === null) {
    throw new Error(
      "This animation needs a clock: run it with scene.addAnimation(...) or a ThreadScheduler instead of stepping the generator yourself.",
    );
  }
  return active;
}

/** Runs `fn` with `clock` as the active one. */
export function withClock<T>(clock: Clock, fn: () => T): T {
  const previous = active;
  active = clock;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

/** A clock on a grid of `step` seconds. */
export function createClock(step: number): Clock {
  return {
    time: 0,
    step,
    driven: new Set(),
    owner: null,
    nextGrid(time) {
      return (Math.floor(time / step + TIME_EPS) + 1) * step;
    },
    onGrid(time) {
      const n = time / step;
      return Math.abs(n - Math.round(n)) < 1e-6;
    },
  };
}

/**
 * What a thread asked for with the value it yielded: a time to be woken at (a number), or to be woken on
 * the next point of the grid (anything else, which is what a bare `yield` is).
 */
export function wakeOf(yielded: unknown): number | null {
  return typeof yielded === "number" ? yielded : null;
}

import { LazyError } from "../utils/LazyUtil";
import type { Signal, ThreadGenerator } from "./Signal";
import { SignalTrace } from "./SignalTrace";

/** The simulation step, in seconds: animations are advanced in slices of this length. */
export const DEFAULT_TIME_STEP = 1 / 240;

/**
 * Options for {@link ThreadScheduler}.
 */
export interface ThreadSchedulerOptions {
  /**
   * Length of one simulation step in seconds. Defaults to `1/240`.
   *
   * Time only ever moves in whole steps, whatever the frame rate, so the same
   * animation gives the same values at 30, 60 or 144 frames per second.
   */
  step?: number;

  /**
   * Whether to remember signal values so the timeline can be moved backwards.
   * `true` keeps ten minutes or a million recorded values, whichever is reached first; `false`
   * turns it off (moving backwards then throws); an object sets `maxSeconds` and `maxEntries`.
   */
  history?: boolean | { maxSeconds?: number; maxEntries?: number };
}

/**
 * Thread scheduler for managing animation generators.
 *
 * Time advances in fixed steps. Moving forwards runs the generators step by step;
 * moving to a moment that was already simulated puts the signals back from the
 * recorded history instead, so any time can be asked for in any order.
 */
export class ThreadScheduler {
  private threads: Set<ThreadGenerator> = new Set();
  /** Threads added but not yet run to their first `yield`. Usually empty. */
  private unprimed: Set<ThreadGenerator> = new Set();
  private currentTime = 0;

  /** Step the signals currently show. */
  private cursor = 0;
  /** Step the generators have been run up to. */
  private furthest = 0;

  private readonly stepSize: number;
  private trace: SignalTrace | null;
  private resets = 0;
  private stepping = false;
  /** Threads added by a running thread; they join after the step. */
  private joining: ThreadGenerator[] = [];

  constructor(options: ThreadSchedulerOptions = {}) {
    this.stepSize = options.step ?? DEFAULT_TIME_STEP;
    if (!(this.stepSize > 0)) throw new LazyError("ThreadScheduler: `step` must be positive");

    const history = options.history ?? true;
    if (history === false) {
      this.trace = null;
    } else {
      const limits = typeof history === "object" ? history : {};
      this.trace = new SignalTrace({
        maxSteps: Math.ceil((limits.maxSeconds ?? 600) / this.stepSize),
        maxEntries: limits.maxEntries,
      });
    }
  }

  /** Changes every time the history is cleared, which is when watched signals must be handed over again. */
  public get generation(): number {
    return this.resets;
  }

  /** Length of one simulation step, in seconds. */
  public get step(): number {
    return this.stepSize;
  }

  /**
   * Adds a thread to the scheduler. It starts at the moment of the last update.
   *
   * @throws {LazyError} If the timeline was moved back while other animations are still
   * running: they cannot be moved back with it, so a new one would start from an
   * inconsistent state. Call {@link ThreadScheduler.clear} first.
   */
  public add(thread: ThreadGenerator): void {
    if (!this.stepping && this.cursor < this.furthest) {
      if (this.threads.size > 0) {
        throw new LazyError(
          "Cannot add an animation after moving the timeline back while other animations are still " +
            "running. Call clearAnimations() and resetTimeline() first.",
        );
      }
      // Nothing is running, so nothing beyond the cursor is real any more: continue from here.
      this.furthest = this.cursor;
      this.trace?.truncate(this.cursor);
    }
    if (this.stepping) {
      this.joining.push(thread);
      return;
    }
    this.threads.add(thread);
    this.unprimed.add(thread);
  }

  /** Remove a thread from the scheduler */
  public remove(thread: ThreadGenerator): void {
    this.threads.delete(thread);
    this.unprimed.delete(thread);
  }

  /**
   * Follows a signal, so that its value comes back when the timeline is moved to an earlier time.
   * Call it for every signal that animations drive.
   */
  public watch(signal: Signal<any>): void {
    this.trace?.watch(signal);
  }

  /**
   * Moves the timeline to `time` seconds.
   *
   * Later than anything simulated so far, the animations are advanced step by step.
   * Earlier, the signals are put back to what they were then. `time` is rounded down
   * to a whole simulation step.
   *
   * @throws {LazyError} If `time` is earlier than the recorded history, or history is off.
   */
  public update(time: number): void {
    const target = Math.max(0, Math.floor(time / this.stepSize + 1e-6));
    this.currentTime = time;

    if (target < this.furthest) {
      if (target !== this.cursor) {
        this.seekRecorded(target);
        this.cursor = target;
      }
      return;
    }

    // At or past the live edge: continue running the generators from there.
    if (this.cursor < this.furthest) {
      this.seekRecorded(this.furthest);
    }
    // From here the signals show the live state; an animation may add another while it runs.
    this.cursor = this.furthest;

    if (this.primeNew()) this.trace?.record(this.furthest);

    while (this.furthest < target) {
      this.runStep();
      this.furthest++;
      this.trace?.record(this.furthest);
    }
    this.cursor = this.furthest;
  }

  /** Clear all threads */
  public clear(): void {
    this.threads.clear();
    this.unprimed.clear();
  }

  /** Get current time */
  public getTime(): number {
    return this.currentTime;
  }

  /** Reset time to `0` and forget the history. Running threads are kept. */
  public reset(): void {
    this.currentTime = 0;
    this.cursor = 0;
    this.furthest = 0;
    this.resets++;
    this.trace?.clear();
  }

  /** Check if scheduler has active threads */
  public hasActiveThreads(): boolean {
    return this.threads.size > 0;
  }

  private seekRecorded(step: number): void {
    if (!this.trace) {
      throw new LazyError(
        "Cannot move the timeline backwards: history is turned off. " +
          "Create the Scene without `history: false`.",
      );
    }
    this.trace.restore(step);
  }

  /** Runs every thread that has not started yet up to its first `yield`. */
  private primeNew(): boolean {
    if (this.unprimed.size === 0) return false;
    const fresh = [...this.unprimed];
    this.unprimed.clear();
    for (const thread of fresh) {
      if (thread.next().done) this.threads.delete(thread);
    }
    return true;
  }

  private runStep(): void {
    // A thread may add another while it runs; that one is primed here, before it takes a step.
    if (this.unprimed.size > 0) this.primeNew();

    // Deleting the thread being visited is safe while iterating a Set.
    this.stepping = true;
    try {
      for (const thread of this.threads) {
        if (thread.next(this.stepSize).done) this.threads.delete(thread);
      }
    } finally {
      this.stepping = false;
      for (const thread of this.joining) {
        this.threads.add(thread);
        this.unprimed.add(thread);
      }
      this.joining = [];
    }
  }
}

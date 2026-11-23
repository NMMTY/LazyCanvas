import { LazyError } from "../utils/LazyUtil";
import type { Signal } from "./Signal";

/** What a signal tells the trace that follows it when its value changes. */
export interface TraceListener {
  dirty(signal: Signal<any>): void;
}

/** The recorded values of one signal: parallel lists, sorted by step. */
class Track {
  steps: number[] = [];
  values: unknown[] = [];
  velocities: number[] = [];
  queued = false;

  constructor(readonly signal: Signal<any>) {}
}

/** Limits on how much a {@link SignalTrace} keeps. */
export interface SignalTraceLimits {
  /** Steps of history to keep. Older ones are dropped. */
  maxSteps?: number;
  /** Recorded values to keep, over all signals. Older ones are dropped. Defaults to a million. */
  maxEntries?: number;
}

/**
 * The values a set of signals had at every simulation step.
 *
 * Generators only run forwards, so a timeline cannot be moved back by running
 * them. Instead the scheduler writes down what each signal looked like after every
 * step; moving to an earlier moment is then a lookup, not a simulation.
 *
 * Only the signals that changed are looked at, and only the steps where a value changed are stored, so
 * a signal that sits still costs nothing. What is kept is bounded by `maxSteps` and `maxEntries`: when
 * either is exceeded the oldest part of the history is dropped, so a scene with thousands of moving
 * signals keeps a shorter history rather than all of the memory.
 */
export class SignalTrace implements TraceListener {
  private readonly tracks = new Map<Signal<any>, Track>();
  private queue: Track[] = [];
  private earliestStep = 0;
  private entries = 0;
  private readonly maxSteps: number;
  private readonly maxEntries: number;

  /**
   * @param {number | SignalTraceLimits} [limits] - How much history to keep: a number of steps,
   * or both limits.
   */
  constructor(limits: number | SignalTraceLimits = {}) {
    const config = typeof limits === "number" ? { maxSteps: limits } : limits;
    this.maxSteps = config.maxSteps ?? Number.POSITIVE_INFINITY;
    this.maxEntries = config.maxEntries ?? 1_000_000;
  }

  /** The oldest step that can still be restored. */
  public get earliest(): number {
    return this.earliestStep;
  }

  /** How many recorded values are held right now, over all signals. */
  public get size(): number {
    return this.entries;
  }

  /** Starts following a signal. Its current value is what it had before any animation. */
  public watch(signal: Signal<any>): void {
    if (this.tracks.has(signal)) return;
    const track = new Track(signal);
    track.steps.push(this.earliestStep);
    track.values.push(signal.value());
    track.velocities.push(signal.velocity());
    this.tracks.set(signal, track);
    this.entries++;
    signal.addTrace(this);
  }

  /** Called by a followed signal when its value changes. */
  public dirty(signal: Signal<any>): void {
    const track = this.tracks.get(signal);
    if (track !== undefined && !track.queued) {
      track.queued = true;
      this.queue.push(track);
    }
  }

  /** Writes down the current value of every signal that changed as the state after `step`. */
  public record(step: number): void {
    const queue = this.queue;
    for (let i = 0; i < queue.length; i++) {
      const track = queue[i];
      track.queued = false;

      const value = track.signal.value();
      const velocity = track.signal.velocity();
      const last = track.steps.length - 1;

      if (track.steps[last] === step) {
        track.values[last] = value;
        track.velocities[last] = velocity;
      } else if (!Object.is(track.values[last], value) || track.velocities[last] !== velocity) {
        track.steps.push(step);
        track.values.push(value);
        track.velocities.push(velocity);
        this.entries++;
      }
    }
    queue.length = 0;

    if (step - this.earliestStep > this.maxSteps * 1.25 || this.entries > this.maxEntries) {
      this.trim(step);
    }
  }

  /**
   * Puts every watched signal back to the value it had after `step`.
   * @throws {LazyError} If `step` is older than the history that was kept.
   */
  public restore(step: number): void {
    if (step < this.earliestStep) {
      throw new LazyError(
        `Cannot seek to step ${step}: the history before step ${this.earliestStep} was dropped. Raise \`history.maxSeconds\` or \`history.maxEntries\` on the Scene to keep more of it.`,
      );
    }

    for (const track of this.tracks.values()) {
      const index = this.indexAt(track.steps, step);
      track.signal.restore(track.values[index], track.velocities[index]);
    }
  }

  /** Forgets everything after `step`, so playback can continue from there with different animations. */
  public truncate(step: number): void {
    for (const track of this.tracks.values()) {
      const keep = this.indexAt(track.steps, step) + 1;
      this.entries -= track.steps.length - keep;
      track.steps.length = keep;
      track.values.length = keep;
      track.velocities.length = keep;
    }
  }

  /** Forgets all history and every watched signal. */
  public clear(): void {
    this.tracks.clear();
    this.queue = [];
    this.earliestStep = 0;
    this.entries = 0;
  }

  /** Drops the oldest part of the history: enough to be within both limits, and then some. */
  private trim(now: number): void {
    let newEarliest = this.earliestStep;
    if (now - this.earliestStep > this.maxSteps) newEarliest = now - this.maxSteps;

    // Over the entry budget: drop the older half of what is held. Halving, rather than trimming to
    // the limit, means the cost is paid once in a while and not on every step.
    while (this.entries > this.maxEntries * 0.75 && newEarliest < now) {
      newEarliest = Math.max(newEarliest + 1, newEarliest + Math.floor((now - newEarliest) / 2));
      this.dropBefore(newEarliest);
    }
    this.dropBefore(newEarliest);
    this.earliestStep = newEarliest;
  }

  private dropBefore(step: number): void {
    for (const track of this.tracks.values()) {
      const index = this.indexAt(track.steps, step);
      if (index > 0) {
        track.steps.splice(0, index);
        track.values.splice(0, index);
        track.velocities.splice(0, index);
        this.entries -= index;
      }
      track.steps[0] = Math.max(track.steps[0], step);
    }
  }

  /** Index of the last entry at or before `step` (entries are sorted by step). */
  private indexAt(steps: number[], step: number): number {
    let low = 0;
    let high = steps.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (steps[mid] <= step) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}

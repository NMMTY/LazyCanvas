import { LazyError } from "../utils/LazyUtil";
import type { Signal, SignalState } from "./Signal";

/** What a signal tells the trace that follows it when its value, or what drives it, changes. */
export interface TraceListener {
  dirty(signal: Signal<any>): void;
}

/** What a signal was like from some time on: parallel lists, sorted by time. */
class Track {
  times: number[] = [];
  states: SignalState[] = [];
  queued = false;

  constructor(readonly signal: Signal<any>) {}
}

/** Limits on how much a {@link SignalTrace} keeps. */
export interface SignalTraceLimits {
  /** Seconds of history to keep. Older ones are dropped. */
  maxSeconds?: number;
  /** Recorded changes to keep, over all signals. Older ones are dropped. Defaults to a million. */
  maxEntries?: number;
}

/**
 * What every signal was like at every time: the history that lets a timeline go back.
 *
 * Generators only run forwards, so a timeline cannot be moved back by running them. Instead each change of a signal
 * is written down: a value that was set, or an animation that was installed on it (which is a function of time
 * and so gives the value at every time in between) and the value it left behind when it ended. Going to an
 * earlier time is then a lookup. A tween that runs for ten seconds is two entries, not two thousand and four
 * hundred.
 *
 * What is kept is bounded by `maxSeconds` and `maxEntries`: when either is exceeded the oldest part of the history
 * is dropped, so a scene with thousands of changing signals keeps less rather than all of the memory.
 */
export class SignalTrace implements TraceListener {
  private readonly tracks = new Map<Signal<any>, Track>();
  private queue: Track[] = [];
  private earliestTime = 0;
  private entries = 0;
  private readonly maxSeconds: number;
  private readonly maxEntries: number;

  /**
   * @param {number | SignalTraceLimits} [limits] - How much history to keep: a number of seconds,
   * or both limits.
   */
  constructor(limits: number | SignalTraceLimits = {}) {
    const config = typeof limits === "number" ? { maxSeconds: limits } : limits;
    this.maxSeconds = config.maxSeconds ?? Number.POSITIVE_INFINITY;
    this.maxEntries = config.maxEntries ?? 1_000_000;
  }

  /** The oldest time that can still be restored. */
  public get earliest(): number {
    return this.earliestTime;
  }

  /** How many recorded changes are held right now, over all signals. */
  public get size(): number {
    return this.entries;
  }

  /** Starts following a signal. How it is now is how it was before any animation. */
  public watch(signal: Signal<any>): void {
    if (this.tracks.has(signal)) return;
    const track = new Track(signal);
    track.times.push(this.earliestTime);
    track.states.push(signal.captureState());
    this.tracks.set(signal, track);
    this.entries++;
    signal.addTrace(this);
  }

  /** Called by a followed signal when it changes. */
  public dirty(signal: Signal<any>): void {
    const track = this.tracks.get(signal);
    if (track !== undefined && !track.queued) {
      track.queued = true;
      this.queue.push(track);
    }
  }

  /** Writes down how every signal that changed is at `time`. */
  public record(time: number): void {
    const queue = this.queue;
    for (let i = 0; i < queue.length; i++) {
      const track = queue[i];
      track.queued = false;

      const state = track.signal.captureState();
      const last = track.times.length - 1;
      const before = track.states[last];

      if (track.times[last] === time) {
        track.states[last] = state;
      } else if (
        before.driver !== state.driver ||
        !Object.is(before.value, state.value) ||
        before.velocity !== state.velocity
      ) {
        track.times.push(time);
        track.states.push(state);
        this.entries++;
      }
    }
    queue.length = 0;

    if (time - this.earliestTime > this.maxSeconds * 1.25 || this.entries > this.maxEntries) {
      this.trim(time);
    }
  }

  /**
   * Puts every watched signal back as it was at `time`.
   * @throws {LazyError} If `time` is older than the history that was kept.
   */
  public restore(time: number): void {
    if (time < this.earliestTime) {
      throw new LazyError(
        `Cannot seek to ${time.toFixed(3)} s: the history before ${this.earliestTime.toFixed(3)} s was dropped. Raise \`history.maxSeconds\` or \`history.maxEntries\` on the Scene to keep more of it.`,
      );
    }

    for (const track of this.tracks.values()) {
      track.signal.restoreState(track.states[this.indexAt(track.times, time)]);
    }
  }

  /** Forgets everything after `time`, so playback can continue from there with different animations. */
  public truncate(time: number): void {
    for (const track of this.tracks.values()) {
      const keep = this.indexAt(track.times, time) + 1;
      this.entries -= track.times.length - keep;
      track.times.length = keep;
      track.states.length = keep;
    }
  }

  /** Forgets all history and every watched signal. */
  public clear(): void {
    this.tracks.clear();
    this.queue = [];
    this.earliestTime = 0;
    this.entries = 0;
  }

  /** Drops the oldest part of the history: enough to be within both limits, and then some. */
  private trim(now: number): void {
    let newEarliest = this.earliestTime;
    if (now - this.earliestTime > this.maxSeconds) newEarliest = now - this.maxSeconds;
    this.dropBefore(newEarliest);

    // Over the entry budget: drop the older half of what is held. Halving, rather than trimming to
    // the limit, means the cost is paid once in a while and not on every change.
    while (this.entries > this.maxEntries * 0.75 && newEarliest < now) {
      newEarliest += Math.max((now - newEarliest) / 2, 1e-6);
      if (now - newEarliest < 1e-6) newEarliest = now;
      this.dropBefore(newEarliest);
    }
    this.earliestTime = newEarliest;
  }

  private dropBefore(time: number): void {
    for (const track of this.tracks.values()) {
      const index = this.indexAt(track.times, time);
      if (index > 0) {
        track.times.splice(0, index);
        track.states.splice(0, index);
        this.entries -= index;
      }
      track.times[0] = Math.max(track.times[0], time);
    }
  }

  /** Index of the last entry at or before `time` (entries are sorted by time). */
  private indexAt(times: number[], time: number): number {
    let low = 0;
    let high = times.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (times[mid] <= time) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}

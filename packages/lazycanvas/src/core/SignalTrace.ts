import { LazyError } from "../utils/LazyUtil";
import type { Signal } from "./Signal";

interface TraceEntry {
  step: number;
  value: unknown;
  velocity: number;
}

/**
 * The values a set of signals had at every simulation step.
 *
 * Generators only run forwards, so a timeline cannot be moved back by running
 * them. Instead the scheduler writes down what each signal looked like after every
 * step; moving to an earlier moment is then a lookup, not a simulation. Only the
 * steps where a value changed are stored, so a signal that sits still costs nothing.
 */
export class SignalTrace {
  private readonly tracks = new Map<Signal<any>, TraceEntry[]>();
  private earliestStep = 0;
  private readonly maxSteps: number;

  /**
   * @param {number} maxSteps - How many steps of history to keep. Older ones are dropped,
   * so a scene that plays for hours does not grow without bound.
   */
  constructor(maxSteps = Number.POSITIVE_INFINITY) {
    this.maxSteps = maxSteps;
  }

  /** The oldest step that can still be restored. */
  public get earliest(): number {
    return this.earliestStep;
  }

  /** Starts following a signal. Its current value is what it had before any animation. */
  public watch(signal: Signal<any>): void {
    if (this.tracks.has(signal)) return;
    this.tracks.set(signal, [
      { step: this.earliestStep, value: signal.value(), velocity: signal.velocity() },
    ]);
  }

  /** Writes down the current value of every watched signal as the state after `step`. */
  public record(step: number): void {
    for (const [signal, entries] of this.tracks) {
      const value = signal.value();
      const velocity = signal.velocity();
      const last = entries[entries.length - 1];
      if (last.step === step) {
        last.value = value;
        last.velocity = velocity;
      } else if (!Object.is(last.value, value) || last.velocity !== velocity) {
        entries.push({ step, value, velocity });
      }
    }

    if (step - this.earliestStep > this.maxSteps * 1.25) {
      this.trimTo(step - this.maxSteps);
    }
  }

  /**
   * Puts every watched signal back to the value it had after `step`.
   * @throws {LazyError} If `step` is older than the history that was kept.
   */
  public restore(step: number): void {
    if (step < this.earliestStep) {
      throw new LazyError(
        `Cannot seek to step ${step}: the history before step ${this.earliestStep} was dropped. Raise \`history.maxSeconds\` on the Scene to keep more of it.`,
      );
    }

    for (const [signal, entries] of this.tracks) {
      const entry = entries[this.indexAt(entries, step)];
      signal.restore(entry.value, entry.velocity);
    }
  }

  /** Forgets everything after `step`, so playback can continue from there with different animations. */
  public truncate(step: number): void {
    for (const entries of this.tracks.values()) {
      const keep = this.indexAt(entries, step) + 1;
      entries.length = keep;
    }
  }

  /** Forgets all history and every watched signal. */
  public clear(): void {
    this.tracks.clear();
    this.earliestStep = 0;
  }

  private trimTo(step: number): void {
    for (const entries of this.tracks.values()) {
      const index = this.indexAt(entries, step);
      if (index > 0) entries.splice(0, index);
      entries[0].step = step;
    }
    this.earliestStep = step;
  }

  /** Index of the last entry at or before `step` (entries are sorted by step). */
  private indexAt(entries: TraceEntry[], step: number): number {
    let low = 0;
    let high = entries.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (entries[mid].step <= step) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}

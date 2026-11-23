import { LazyError } from "../utils/LazyUtil";
import { type Clock, TIME_EPS, createClock, withClock } from "./Clock";
import type { Signal, ThreadGenerator } from "./Signal";
import { SignalTrace } from "./SignalTrace";

/** The grid that animations which are polled run on, in seconds. */
export const DEFAULT_TIME_STEP = 1 / 240;

/**
 * Options for {@link ThreadScheduler}.
 */
export interface ThreadSchedulerOptions {
  /**
   * Length of one step of the grid, in seconds. Defaults to `1/240`.
   *
   * Animations made with `signal.to()`, `waitFor()`, `all()` and the like do not run on it: they are woken at the exact
   * moment they are due. A generator you write yourself that does a bare `yield` is resumed on the grid, once per
   * step, with the time that passed as the value of the `yield`.
   */
  step?: number;

  /**
   * Whether to remember what signals did so the timeline can be moved backwards.
   * `true` keeps ten minutes or a million recorded changes, whichever is reached first; `false`
   * turns it off (moving backwards then throws); an object sets `maxSeconds` and `maxEntries`.
   */
  history?: boolean | { maxSeconds?: number; maxEntries?: number };
}

/** A running animation and when it wants to be resumed. */
interface Entry {
  thread: ThreadGenerator;
  /** Time it asked to be woken at; `null` if it asked for the next step of the grid. */
  wake: number | null;
  /** When it was last resumed, for the time that has passed since. */
  last: number;
  /** Order it was added in: what is due at the same time runs in this order. */
  seq: number;
  alive: boolean;
  /** Bumped every time it is scheduled, so that older places in the queue can be told from the current one. */
  version: number;
}

interface QueueItem {
  wake: number;
  seq: number;
  entry: Entry;
  version: number;
}

/** A binary min-heap of the times animations are due. */
class WakeQueue {
  private items: QueueItem[] = [];

  get size(): number {
    return this.items.length;
  }

  peek(): QueueItem | undefined {
    return this.items[0];
  }

  clear(): void {
    this.items = [];
  }

  push(item: QueueItem): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.before(items[parent], items[i])) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): QueueItem | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last !== undefined) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && this.before(items[left], items[smallest])) smallest = left;
        if (right < items.length && this.before(items[right], items[smallest])) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  private before(a: QueueItem, b: QueueItem): boolean {
    return a.wake < b.wake || (a.wake === b.wake && a.seq < b.seq);
  }
}

/** How many times one animation may be resumed at the same moment before it is taken for a loop. */
const MAX_RESUMES_AT_ONE_TIME = 100_000;

/**
 * Runs animations: generators that sleep until a time, or ask to be polled.
 *
 * The scheduler does not step through time. It jumps from one moment something is due to the next, so the work
 * is the number of moments animations start and end, not the number of steps or signals. In between, the
 * value of a signal being animated is worked out when it is read.
 *
 * Moving to a time that was already reached puts the signals back from the history instead, so any time can be
 * asked for in any order.
 */
export class ThreadScheduler {
  private entries = new Map<ThreadGenerator, Entry>();
  private queue = new WakeQueue();
  /** Animations that asked for the next step of the grid. */
  private polls = new Set<Entry>();
  /** Animations added but not yet run to their first `yield`. Usually empty. */
  private unprimed: Entry[] = [];
  /** Animations added by a running one; they join when it has finished. */
  private joining: Entry[] = [];
  private running = false;
  private seq = 0;
  private resets = 0;

  private readonly clock: Clock;
  private currentTime = 0;
  /** The time the signals show. */
  private cursor = 0;
  /** The latest time that has been run to. */
  private furthest = 0;

  private readonly stepSize: number;
  private trace: SignalTrace | null;

  constructor(options: ThreadSchedulerOptions = {}) {
    this.stepSize = options.step ?? DEFAULT_TIME_STEP;
    if (!(this.stepSize > 0)) throw new LazyError("ThreadScheduler: `step` must be positive");
    this.clock = createClock(this.stepSize);

    const history = options.history ?? true;
    if (history === false) {
      this.trace = null;
    } else {
      const limits = typeof history === "object" ? history : {};
      this.trace = new SignalTrace({
        maxSeconds: limits.maxSeconds ?? 600,
        maxEntries: limits.maxEntries,
      });
    }
  }

  /** Changes every time the history is cleared, which is when watched signals must be handed over again. */
  public get generation(): number {
    return this.resets;
  }

  /** Length of one step of the grid, in seconds. */
  public get step(): number {
    return this.stepSize;
  }

  /**
   * Adds a thread to the scheduler. It starts at the time of the last update.
   *
   * @throws {LazyError} If the timeline was moved back while other animations are still
   * running: they cannot be moved back with it, so a new one would start from an
   * inconsistent state. Call {@link ThreadScheduler.clear} first.
   */
  public add(thread: ThreadGenerator): void {
    const entry: Entry = {
      thread,
      wake: null,
      last: 0,
      seq: this.seq++,
      alive: true,
      version: 0,
    };

    if (this.running) {
      this.joining.push(entry);
      return;
    }

    if (this.cursor < this.furthest) {
      if (this.entries.size > 0) {
        throw new LazyError(
          "Cannot add an animation after moving the timeline back while other animations are still " +
            "running. Call clearAnimations() and resetTimeline() first.",
        );
      }
      // Nothing is running, so nothing beyond the cursor is real any more: continue from here.
      this.furthest = this.cursor;
      this.trace?.truncate(this.cursor);
    }
    this.entries.set(thread, entry);
    this.unprimed.push(entry);
  }

  /** Remove a thread from the scheduler. What it was animating stays where it is. */
  public remove(thread: ThreadGenerator): void {
    const entry = this.entries.get(thread);
    if (!entry) return;
    entry.alive = false;
    this.entries.delete(thread);
    this.polls.delete(entry);
    this.unprimed = this.unprimed.filter((e) => e !== entry);

    for (const signal of [...this.clock.driven]) {
      if (signal.drivenBy(thread)) signal.freeze();
    }
  }

  /**
   * Follows a signal, so that it comes back as it was when the timeline is moved to an earlier time.
   * Call it for every signal that animations drive.
   */
  public watch(signal: Signal<any>): void {
    this.trace?.watch(signal);
  }

  /**
   * Moves the timeline to `time` seconds.
   *
   * Later than anything run so far, the animations run up to it, each woken at the moment it is due.
   * Earlier, the signals are put back to what they were then.
   *
   * @throws {LazyError} If `time` is earlier than the recorded history, or history is off.
   */
  public update(time: number): void {
    const target = Math.max(0, time);
    this.currentTime = time;

    if (target < this.furthest) {
      if (target !== this.cursor) {
        this.seekRecorded(target);
        this.cursor = target;
      }
      return;
    }

    // At or past the live edge: continue running the animations from there.
    if (this.cursor < this.furthest) this.seekRecorded(this.furthest);
    this.cursor = this.furthest;

    withClock(this.clock, () => {
      this.running = true;
      try {
        this.primeNew();
        for (;;) {
          const next = this.nextEvent();
          if (next > target + TIME_EPS) break;
          this.runAt(Math.max(next, this.clock.time));
        }
      } finally {
        this.running = false;
      }
    });

    this.clock.time = target;
    this.furthest = target;
    this.cursor = target;
    this.trace?.record(target);
  }

  /**
   * Runs the animations until none is left, and returns the time the last of them ended at.
   *
   * An animation that is polled and never ends keeps it going, so it stops at `maxSeconds`.
   */
  public runToEnd(maxSeconds = 3600): number {
    withClock(this.clock, () => {
      this.running = true;
      try {
        this.primeNew();
        while (this.entries.size > 0) {
          const next = this.nextEvent();
          if (!Number.isFinite(next) || next > maxSeconds) break;
          this.runAt(Math.max(next, this.clock.time));
        }
      } finally {
        this.running = false;
      }
    });
    this.furthest = this.clock.time;
    this.cursor = this.clock.time;
    this.trace?.record(this.clock.time);
    return this.clock.time;
  }

  /** Stops every animation. What they were animating stays where it is. */
  public clear(): void {
    for (const entry of this.entries.values()) entry.alive = false;
    for (const entry of this.joining) entry.alive = false;
    this.entries.clear();
    this.queue.clear();
    this.polls.clear();
    this.unprimed = [];
    this.joining = [];

    for (const signal of [...this.clock.driven]) signal.freeze();
    this.clock.driven.clear();
  }

  /** How many changes the history holds right now, over all signals. */
  public get historySize(): number {
    return this.trace?.size ?? 0;
  }

  /** The time of the last update. */
  public getTime(): number {
    return this.currentTime;
  }

  /** Stops every animation, sets the time back to `0` and forgets the history. */
  public reset(): void {
    this.clear();
    this.currentTime = 0;
    this.clock.time = 0;
    this.cursor = 0;
    this.furthest = 0;
    this.resets++;
    this.trace?.clear();
  }

  /** Check if scheduler has active threads */
  public hasActiveThreads(): boolean {
    return this.entries.size > 0 || this.joining.length > 0;
  }

  private seekRecorded(time: number): void {
    if (!this.trace) {
      throw new LazyError(
        "Cannot move the timeline backwards: history is turned off. " +
          "Create the Scene without `history: false`.",
      );
    }
    this.trace.restore(time);
    this.clock.time = time;
  }

  /** The next time something is due: an animation asleep until then, or a step of the grid for one that is polled. */
  private nextEvent(): number {
    let next = Number.POSITIVE_INFINITY;

    // Entries that were rescheduled or stopped leave their old place in the queue; skip those.
    let top = this.queue.peek();
    while (top !== undefined && (!top.entry.alive || top.version !== top.entry.version)) {
      this.queue.pop();
      top = this.queue.peek();
    }
    if (top !== undefined) next = top.wake;

    if (this.polls.size > 0) {
      next = Math.min(next, this.clock.nextGrid(this.clock.time));
    }
    return next;
  }

  /** Runs the animations that are due at `time`. */
  private runAt(time: number): void {
    const clock = this.clock;
    clock.time = time;

    const due: Entry[] = [];
    for (;;) {
      const top = this.queue.peek();
      if (top === undefined || top.wake > time + TIME_EPS) break;
      this.queue.pop();
      if (top.entry.alive && top.version === top.entry.version) due.push(top.entry);
    }
    if (this.polls.size > 0 && clock.onGrid(time)) {
      for (const entry of this.polls) if (time > entry.last + TIME_EPS) due.push(entry);
      for (const entry of due) this.polls.delete(entry);
    }
    due.sort((a, b) => a.seq - b.seq);

    // What is resumed may ask to be resumed again at once (a wait of no length, or one that
    // ends at the moment it is made), or add animations of its own; both are dealt with here.
    for (let i = 0; i < due.length; i++) {
      if (i >= MAX_RESUMES_AT_ONE_TIME) {
        throw new LazyError(
          "An animation keeps asking to be resumed without any time passing (a loop whose body takes no time?).",
        );
      }
      const entry = due[i];
      if (!entry.alive) continue;
      this.resume(entry, time, due);
      if (this.joining.length > 0) this.primeJoined(due);
    }

    this.trace?.record(time);
  }

  /** Resumes an animation at `time`, and files what it asks for. */
  private resume(entry: Entry, time: number, due: Entry[]): void {
    this.clock.owner = entry.thread;
    const delta = time - entry.last;
    entry.last = time;
    this.file(entry, entry.thread.next(delta), time, due);
  }

  private file(
    entry: Entry,
    result: IteratorResult<number | undefined, void>,
    time: number,
    due: Entry[],
  ): void {
    if (result.done) {
      entry.alive = false;
      this.entries.delete(entry.thread);
      return;
    }

    entry.version++;
    if (typeof result.value === "number") {
      entry.wake = result.value;
      if (result.value <= time + TIME_EPS) {
        due.push(entry);
      } else {
        this.queue.push({ wake: result.value, seq: entry.seq, entry, version: entry.version });
      }
    } else {
      entry.wake = null;
      this.polls.add(entry);
    }
  }

  /** Runs every animation that has not started yet up to its first `yield`. */
  private primeNew(): void {
    while (this.unprimed.length > 0) {
      const fresh = this.unprimed;
      this.unprimed = [];
      const due: Entry[] = [];
      for (const entry of fresh) {
        if (!entry.alive) continue;
        this.clock.owner = entry.thread;
        entry.last = this.clock.time;
        this.file(entry, entry.thread.next(), this.clock.time, due);
      }
      // Asked to be resumed at once: run them at this moment before going on.
      for (let i = 0; i < due.length; i++) {
        if (i >= MAX_RESUMES_AT_ONE_TIME) {
          throw new LazyError("An animation keeps asking to be resumed without any time passing.");
        }
        if (due[i].alive) this.resume(due[i], this.clock.time, due);
      }
      if (this.joining.length > 0) this.primeJoined([]);
    }
    this.trace?.record(this.clock.time);
  }

  /** Brings in animations that a running one added, and starts them at this moment. */
  private primeJoined(due: Entry[]): void {
    const joined = this.joining;
    this.joining = [];
    for (const entry of joined) {
      if (!entry.alive) continue;
      this.entries.set(entry.thread, entry);
      this.clock.owner = entry.thread;
      entry.last = this.clock.time;
      this.file(entry, entry.thread.next(), this.clock.time, due);
    }
  }
}

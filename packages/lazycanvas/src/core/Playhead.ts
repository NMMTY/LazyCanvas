import { LazyError } from "../utils/LazyUtil";

/**
 * Options for {@link Playhead}.
 */
export interface PlayheadOptions {
  /** Length of the animation in seconds. */
  duration: number;
  /** Playback speed: `2` is twice as fast, `0.5` half speed. Defaults to `1`. */
  speed?: number;
  /** Start again from the beginning when the end is reached. Defaults to `false`. */
  loop?: boolean;
  /** With `loop`, play forwards and then backwards instead of jumping back. Defaults to `false`. */
  yoyo?: boolean;
  /** Where to start, in seconds. Defaults to `0`. */
  time?: number;
  /** Start playing right away. Defaults to `false`. */
  playing?: boolean;
}

/**
 * The clock of a player: a time that can be played, paused, reversed, sped up, looped and
 * moved anywhere.
 *
 * It only does the arithmetic. You call `tick()` from your own loop (`requestAnimationFrame`,
 * a slider, a test) and pass the time it returns to `scene.renderFrame()`. Because a scene can
 * be rendered at any time in any order, reverse and scrubbing need nothing else.
 *
 * @example
 * ```ts
 * const head = new Playhead({ duration: scene.duration, loop: true });
 * head.play();
 *
 * let last = performance.now();
 * function frame(now: number) {
 *   scene.renderFrame(head.tick((now - last) / 1000));
 *   last = now;
 *   requestAnimationFrame(frame);
 * }
 * requestAnimationFrame(frame);
 * ```
 */
export class Playhead {
  /** Length of the animation in seconds. */
  public duration: number;
  /** Playback speed. Negative plays backwards. */
  public speed: number;
  /** Whether it starts again at the end. */
  public loop: boolean;
  /** With `loop`: whether it turns around at the ends. */
  public yoyo: boolean;

  private current: number;
  private running: boolean;
  private direction: 1 | -1 = 1;
  private finished = false;

  constructor(options: PlayheadOptions) {
    if (!(options.duration >= 0) || !Number.isFinite(options.duration)) {
      throw new LazyError("Playhead: `duration` must be a finite number of seconds");
    }
    this.duration = options.duration;
    this.speed = options.speed ?? 1;
    this.loop = options.loop ?? false;
    this.yoyo = options.yoyo ?? false;
    this.current = Math.min(Math.max(options.time ?? 0, 0), this.duration);
    this.running = options.playing ?? false;
  }

  /** The current time in seconds. */
  public get time(): number {
    return this.current;
  }

  /** Whether the playhead is moving. */
  public get playing(): boolean {
    return this.running;
  }

  /** Whether it stopped at the end (or the start, when reversed). Cleared by `play` and `seek`. */
  public get ended(): boolean {
    return this.finished;
  }

  /** Starts moving. From the end it starts again from the beginning (or from the end, if reversed). */
  public play(): this {
    if (this.finished) {
      this.current = this.effectiveSpeed() >= 0 ? 0 : this.duration;
      this.finished = false;
    }
    this.running = true;
    return this;
  }

  /** Stops where it is. */
  public pause(): this {
    this.running = false;
    return this;
  }

  /** Moves to a time, clamped to the animation. Keeps playing if it was playing. */
  public seek(time: number): this {
    this.current = Math.min(Math.max(time, 0), this.duration);
    this.finished = false;
    return this;
  }

  /** Turns the direction around. */
  public reverse(): this {
    this.direction = this.direction === 1 ? -1 : 1;
    this.finished = false;
    return this;
  }

  /**
   * Moves the time on by `seconds` of real time (scaled by `speed`) and returns it.
   * Does nothing while paused.
   */
  public tick(seconds: number): number {
    if (!this.running || this.duration === 0) return this.current;

    let remaining = seconds * Math.abs(this.speed);
    let direction = this.effectiveSpeed() >= 0 ? 1 : -1;

    // A step can cross the end more than once when the frame is long and the animation short.
    while (remaining > 0) {
      const room = direction === 1 ? this.duration - this.current : this.current;
      if (remaining < room) {
        this.current += direction * remaining;
        break;
      }

      remaining -= room;
      this.current = direction === 1 ? this.duration : 0;

      if (!this.loop) {
        this.running = false;
        this.finished = true;
        break;
      }
      if (this.yoyo) {
        this.direction = this.direction === 1 ? -1 : 1;
        direction = direction === 1 ? -1 : 1;
      } else {
        this.current = direction === 1 ? 0 : this.duration;
      }
    }
    return this.current;
  }

  private effectiveSpeed(): number {
    return this.speed * this.direction;
  }
}

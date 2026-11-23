import { LazyError } from "../utils/LazyUtil";

/**
 * The physical parameters of a spring, and when to call it settled.
 */
export interface SpringConfig {
  /** How hard the spring pulls towards the target. Higher is faster and bouncier. Defaults to `170`. */
  stiffness?: number;
  /** How quickly the motion dies out. Higher is less bouncy. Defaults to `26`. */
  damping?: number;
  /** How heavy the moving thing is. Higher is slower to start and stop. Defaults to `1`. */
  mass?: number;
  /**
   * Speed at the start, in units per second. A numeric signal that is already moving
   * continues at its own speed; this overrides it.
   */
  velocity?: number;
  /**
   * The spring is settled when it is closer to the target than this. Defaults to 0.1% of the
   * distance it has to travel (and at least `0.001`), so a small and a large move settle in the
   * same time.
   */
  restDelta?: number;
  /** ...and moves slower than this, in units per second. Defaults to 1% of the distance per second. */
  restSpeed?: number;
  /** Longest the spring may run, in seconds, for a spring that never settles. Defaults to `20`. */
  maxDuration?: number;
}

/**
 * Ready-made springs. `default` is critically damped: it reaches the target without overshooting.
 */
export const SpringPresets = {
  /** Smooth and quick, no overshoot. */
  default: { stiffness: 170, damping: 26 },
  /** Slow and soft. */
  gentle: { stiffness: 120, damping: 14 },
  /** Loose, with a visible bounce. */
  wobbly: { stiffness: 180, damping: 12 },
  /** Fast with a small overshoot. */
  stiff: { stiffness: 210, damping: 20 },
  /** Very quick and firm. */
  snappy: { stiffness: 400, damping: 30 },
  /** Heavy and slow. */
  slow: { stiffness: 280, damping: 60 },
  /** Slower still. */
  molasses: { stiffness: 280, damping: 120 },
} as const satisfies Record<string, SpringConfig>;

/** Name of a spring in {@link SpringPresets}. */
export type SpringPresetName = keyof typeof SpringPresets;

/**
 * How a spring moves from a starting point to its target.
 *
 * It is a function of time, not a simulation: `position(t)` gives the same answer at
 * any frame rate and for any `t` in any order.
 */
export interface SpringMotion {
  /** Seconds until the spring has settled. `0` if it starts at rest on the target. */
  readonly duration: number;
  /** Where it is `t` seconds after the start. */
  position(t: number): number;
  /** How fast it is moving `t` seconds after the start, in units per second. */
  velocity(t: number): number;
}

const SETTLE_STEP = 1 / 240;

/**
 * Resolves a preset name or a config into a full config.
 * @throws {LazyError} For an unknown preset or an impossible parameter.
 */
export function resolveSpringConfig(config: SpringConfig | SpringPresetName = {}): SpringConfig {
  if (typeof config === "string") {
    const preset = SpringPresets[config];
    if (!preset) {
      throw new LazyError(
        `Unknown spring preset "${config}". Use one of: ${Object.keys(SpringPresets).join(", ")}.`,
      );
    }
    return preset;
  }
  return config;
}

/**
 * Solves a damped spring analytically.
 *
 * The motion `m·x'' = -k·x - c·x'` has a closed-form answer for the three cases (under-,
 * critically and over-damped), so there is no integration error and no dependence on the step.
 *
 * @param {number} from - Where it starts.
 * @param {number} to - The target it settles on.
 * @param {SpringConfig | SpringPresetName} [config] - The spring.
 * @param {number} [velocity] - Speed at the start. Overridden by `config.velocity`.
 * @returns {SpringMotion} The motion.
 * @throws {LazyError} If stiffness or mass is not positive, or damping is negative.
 */
export function solveSpring(
  from: number,
  to: number,
  config: SpringConfig | SpringPresetName = {},
  velocity = 0,
): SpringMotion {
  const spring = resolveSpringConfig(config);
  const stiffness = spring.stiffness ?? SpringPresets.default.stiffness;
  const damping = spring.damping ?? SpringPresets.default.damping;
  const mass = spring.mass ?? 1;
  const v0 = spring.velocity ?? velocity;

  if (!(stiffness > 0) || !(mass > 0) || !(damping >= 0)) {
    throw new LazyError(
      `A spring needs stiffness > 0, mass > 0 and damping >= 0 (got stiffness ${stiffness}, damping ${damping}, mass ${mass}).`,
    );
  }

  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const d0 = from - to;

  let displacement: (t: number) => number;
  let speed: (t: number) => number;

  if (zeta < 1 - 1e-9) {
    const decay = zeta * w0;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const b = (v0 + decay * d0) / wd;
    displacement = (t) => Math.exp(-decay * t) * (d0 * Math.cos(wd * t) + b * Math.sin(wd * t));
    speed = (t) =>
      Math.exp(-decay * t) *
      ((b * wd - decay * d0) * Math.cos(wd * t) - (d0 * wd + decay * b) * Math.sin(wd * t));
  } else if (zeta <= 1 + 1e-9) {
    const c = v0 + w0 * d0;
    displacement = (t) => Math.exp(-w0 * t) * (d0 + c * t);
    speed = (t) => Math.exp(-w0 * t) * (v0 - w0 * c * t);
  } else {
    const s = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * zeta + s;
    const r2 = -w0 * zeta - s;
    const c2 = (v0 - r1 * d0) / (r2 - r1);
    const c1 = d0 - c2;
    displacement = (t) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    speed = (t) => c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t);
  }

  const distance = Math.abs(d0);
  const restDelta = spring.restDelta ?? Math.max(distance * 1e-3, 1e-3);
  const restSpeed = spring.restSpeed ?? Math.max(distance * 1e-2, 1e-2);
  const maxDuration = spring.maxDuration ?? 20;

  let duration = 0;
  if (Math.abs(d0) > restDelta || Math.abs(v0) > restSpeed) {
    duration = maxDuration;
    const steps = Math.ceil(maxDuration / SETTLE_STEP);
    for (let n = 1; n <= steps; n++) {
      const t = n * SETTLE_STEP;
      if (Math.abs(displacement(t)) <= restDelta && Math.abs(speed(t)) <= restSpeed) {
        duration = Math.round(t * 1e9) / 1e9;
        break;
      }
    }
  }

  return {
    duration,
    position: (t) => (t >= duration ? to : to + displacement(Math.max(t, 0))),
    velocity: (t) => (t >= duration ? 0 : speed(Math.max(t, 0))),
  };
}

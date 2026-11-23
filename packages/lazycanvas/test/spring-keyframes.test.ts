import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import {
  Easing,
  Group,
  Keyframes,
  LazyError,
  Morph,
  Playhead,
  Scene,
  type Signal,
  SpringPresets,
  ThreadScheduler,
  all,
  chain,
  createSignal,
  cubicBezier,
  delay,
  durationOf,
  solveSpring,
  spring,
  steps,
  timeline,
  waitFor,
} from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

/** Plays `build` on a scheduler, frame by frame at `fps`, and returns the signal at `until`. */
function playAt<T>(
  signal: Signal<T>,
  fps: number,
  until: number,
  build: () => Generator<any, void, any>,
): T {
  const scheduler = new ThreadScheduler();
  scheduler.add(build());
  const frames = Math.round(until * fps);
  for (let i = 0; i <= frames; i++) scheduler.update(i / fps);
  return signal.value();
}

/** Reference answer: the spring equation stepped with a very small timestep (RK4). */
function integrate(
  from: number,
  to: number,
  k: number,
  c: number,
  m: number,
  v0: number,
  t: number,
) {
  const accel = (x: number, v: number) => (-k * (x - to) - c * v) / m;
  let x = from;
  let v = v0;
  const dt = 1e-4;
  for (let time = 0; time < t - 1e-12; time += dt) {
    const k1x = v;
    const k1v = accel(x, v);
    const k2x = v + (dt / 2) * k1v;
    const k2v = accel(x + (dt / 2) * k1x, v + (dt / 2) * k1v);
    const k3x = v + (dt / 2) * k2v;
    const k3v = accel(x + (dt / 2) * k2x, v + (dt / 2) * k2v);
    const k4x = v + dt * k3v;
    const k4v = accel(x + dt * k3x, v + dt * k3v);
    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return { x, v };
}

describe("solveSpring", () => {
  const regimes = [
    ["under-damped", 170, 12, 1],
    ["critically damped", 100, 20, 1],
    ["over-damped", 100, 40, 1],
    ["heavy", 50, 6, 3],
  ] as const;

  for (const [name, k, c, m] of regimes) {
    it(`matches a fine numerical integration (${name})`, () => {
      const motion = solveSpring(10, 110, { stiffness: k, damping: c, mass: m }, 25);
      for (const t of [0.05, 0.3, 0.8]) {
        const reference = integrate(10, 110, k, c, m, 25, t);
        expect(motion.position(t), `x(${t})`).toBeCloseTo(reference.x, 2);
        expect(motion.velocity(t), `v(${t})`).toBeCloseTo(reference.v, 1);
      }
    });
  }

  it("starts at the start point with the given speed", () => {
    const motion = solveSpring(0, 100, { stiffness: 170, damping: 14 }, 40);
    expect(motion.position(0)).toBeCloseTo(0, 9);
    expect(motion.velocity(0)).toBeCloseTo(40, 9);
  });

  it("lets config.velocity override the inherited speed", () => {
    const motion = solveSpring(0, 100, { velocity: -10 }, 40);
    expect(motion.velocity(0)).toBeCloseTo(-10, 9);
  });

  it("settles exactly on the target", () => {
    const motion = solveSpring(0, 300, "wobbly");
    expect(motion.duration).toBeGreaterThan(0);
    expect(motion.position(motion.duration)).toBe(300);
    expect(motion.position(motion.duration + 5)).toBe(300);
    expect(motion.velocity(motion.duration)).toBe(0);
  });

  it("settles in the same time for a small and a large move", () => {
    const small = solveSpring(0, 10, "default").duration;
    const large = solveSpring(0, 1000, "default").duration;
    expect(small).toBeCloseTo(large, 2);
  });

  it("does not overshoot when critically damped, and does when it is loose", () => {
    const smooth = solveSpring(0, 100, "default");
    const loose = solveSpring(0, 100, "wobbly");
    let smoothMax = 0;
    let looseMax = 0;
    for (let t = 0; t <= 2; t += 0.005) {
      smoothMax = Math.max(smoothMax, smooth.position(t));
      looseMax = Math.max(looseMax, loose.position(t));
    }
    expect(smoothMax).toBeLessThanOrEqual(100.001);
    expect(looseMax).toBeGreaterThan(105);
  });

  it("has no duration when it starts at rest on the target", () => {
    expect(solveSpring(5, 5).duration).toBe(0);
  });

  it("stops an undamped spring at maxDuration", () => {
    expect(solveSpring(0, 1, { damping: 0, maxDuration: 3 }).duration).toBe(3);
  });

  it("rejects impossible parameters and unknown presets", () => {
    expect(() => solveSpring(0, 1, { stiffness: 0 })).toThrow(LazyError);
    expect(() => solveSpring(0, 1, { mass: -1 })).toThrow(LazyError);
    expect(() => solveSpring(0, 1, { damping: -1 })).toThrow(LazyError);
    expect(() => solveSpring(0, 1, "bouncy" as any)).toThrow(/Unknown spring preset/);
  });

  it("has every preset solvable", () => {
    for (const name of Object.keys(SpringPresets)) {
      expect(solveSpring(0, 1, name as keyof typeof SpringPresets).duration).toBeGreaterThan(0);
    }
  });
});

describe("signal.spring", () => {
  it("ends exactly on the target", () => {
    const x = createSignal(0);
    expect(playAt(x, 60, 3, () => x.spring(300))).toBe(300);
    expect(x.velocity()).toBe(0);
  });

  it("gives the same value at 30, 60 and 144 fps", () => {
    const values = [30, 60, 144].map((fps) => {
      const x = createSignal(0);
      return playAt(x, fps, 0.5, () => x.spring(100, "wobbly"));
    });
    expect(values[1]).toBeCloseTo(values[0], 9);
    expect(values[2]).toBeCloseTo(values[0], 9);
  });

  it("continues the speed of the animation it interrupts", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    const tween = x.to(100, 1); // 100 units per second
    scheduler.add(tween);
    scheduler.update(0);
    scheduler.update(0.5);
    expect(x.velocity()).toBeCloseTo(100, 3);

    scheduler.remove(tween);
    scheduler.add(x.spring(200));
    scheduler.update(0.5 + scheduler.step);

    // The same spring from rest, for comparison.
    const rest = createSignal(50);
    const restScheduler = new ThreadScheduler();
    restScheduler.add(rest.spring(200));
    restScheduler.update(0);
    restScheduler.update(restScheduler.step);

    // A spring is linear, so the inherited speed adds about speed × step on top of that
    // (100 units/s for 1/240 s, less a little damping).
    const extra = x.value() - rest.value();
    expect(extra).toBeGreaterThan(0.38);
    expect(extra).toBeLessThan(100 * scheduler.step);
  });

  it("blends colours and points from rest", () => {
    const color = createSignal("#000000");
    const point = createSignal({ x: 0, y: 0 });
    const scheduler = new ThreadScheduler();
    scheduler.add(all(color.spring("#ffffff"), point.spring({ x: 100, y: 50 })));
    scheduler.update(0);
    scheduler.update(0.2);
    expect(color.value()).not.toBe("#000000");
    expect(point.value().x).toBeGreaterThan(0);
    expect(point.value().x).toBeLessThan(100);
    scheduler.update(5);
    expect(color.value()).toBe("#ffffff");
    expect(point.value()).toEqual({ x: 100, y: 50 });
  });

  it("keeps colour channels in range when the spring overshoots", () => {
    const color = createSignal("#102030");
    const scheduler = new ThreadScheduler();
    scheduler.add(color.spring("#f0f0f0", { stiffness: 200, damping: 4 }));
    scheduler.update(0);
    for (let t = 0.01; t < 2; t += 0.01) {
      scheduler.update(t);
      const [r, g, b, a] = (color.value().match(/[\d.]+/g) as string[]).map(Number);
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("is the same as the spring() helper", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const x = playAt(a, 60, 0.4, () => a.spring(80, { stiffness: 150, damping: 10 }));
    const y = playAt(b, 60, 0.4, () => spring(b, 80, { stiffness: 150, damping: 10 }));
    expect(y).toBeCloseTo(x, 9);
  });

  it("can be scrubbed backwards and forwards on a scene", async () => {
    const run = async (times: number[]) => {
      const x = createSignal(0);
      const box = new Morph({
        color: "#f00",
        size: { width: 5, height: 5 },
        position: { x, y: 0 },
      });
      const scene = new Scene(50, 10, { adapter });
      scene.load(new Group({}).add(box));
      scene.addAnimation(() => chain(x.spring(100, "wobbly"), x.spring(20, "gentle")));
      const seen: number[] = [];
      for (const t of times) {
        await scene.renderFrame(t);
        seen.push(box.props.position?.x as number);
      }
      return seen;
    };
    const forward = await run([0.3, 1, 2.5]);
    const scrubbed = await run([2.5, 0.3, 1, 2.5, 0.3]);
    expect(scrubbed[1]).toBeCloseTo(forward[0], 9);
    expect(scrubbed[2]).toBeCloseTo(forward[1], 9);
    expect(scrubbed[3]).toBeCloseTo(forward[2], 9);
    expect(scrubbed[4]).toBeCloseTo(forward[0], 9);
  });

  it("knows how long it will take", () => {
    const x = createSignal(0);
    expect(durationOf(x.spring(100, "snappy"))).toBeCloseTo(
      solveSpring(0, 100, "snappy").duration,
      9,
    );
  });

  it("reports a bad config when it is created, not when it runs", () => {
    const x = createSignal(0);
    expect(() => x.spring(10, { stiffness: -1 })).toThrow(LazyError);
  });
});

describe("Keyframes", () => {
  it("passes through each keyframe and eases each stretch with its own easing", () => {
    const track = new Keyframes([
      { at: 0, value: 0, easing: Easing.easeIn },
      { at: 1, value: 100 },
      { at: 2, value: 0 },
    ]);
    expect(track.valueAt(0)).toBe(0);
    expect(track.valueAt(1)).toBe(100);
    expect(track.valueAt(2)).toBe(0);
    expect(track.valueAt(0.5)).toBeCloseTo(25, 9); // easeIn(0.5) = 0.25
    expect(track.valueAt(1.5)).toBeCloseTo(50, 9); // linear
    expect(track.duration).toBe(2);
  });

  it("holds the first value before the start and the last after the end", () => {
    const track = new Keyframes([
      { at: 1, value: 10 },
      { at: 2, value: 20 },
    ]);
    expect(track.valueAt(0)).toBe(10);
    expect(track.valueAt(5)).toBe(20);
  });

  it("spreads plain values evenly over the duration", () => {
    const track = new Keyframes([0, 100, 50], { duration: 2 });
    expect(track.valueAt(1)).toBe(100);
    expect(track.valueAt(0.5)).toBeCloseTo(50, 9);
    expect(track.valueAt(1.5)).toBeCloseTo(75, 9);
  });

  it("accepts offsets as a fraction of the duration", () => {
    const track = new Keyframes(
      [
        { offset: 0, value: 0 },
        { offset: 0.25, value: 100 },
        { offset: 1, value: 0 },
      ],
      { duration: 4 },
    );
    expect(track.valueAt(1)).toBe(100);
    expect(track.valueAt(2.5)).toBeCloseTo(50, 9);
  });

  it("sorts keyframes that are written out of order", () => {
    const track = new Keyframes([
      { at: 2, value: 20 },
      { at: 0, value: 0 },
      { at: 1, value: 10 },
    ]);
    expect(track.valueAt(0.5)).toBeCloseTo(5, 9);
    expect(track.valueAt(1.5)).toBeCloseTo(15, 9);
  });

  it("jumps where two keyframes share a time", () => {
    const track = new Keyframes([
      { at: 0, value: 0 },
      { at: 1, value: 10 },
      { at: 1, value: 50 },
      { at: 2, value: 60 },
    ]);
    expect(track.valueAt(0.999)).toBeCloseTo(10, 1);
    expect(track.valueAt(1)).toBe(50);
    expect(track.valueAt(1.5)).toBeCloseTo(55, 9);
  });

  it("holds the last value when the duration is longer", () => {
    const track = new Keyframes(
      [
        { at: 1, value: 5 },
        { at: 2, value: 9 },
      ],
      { duration: 10 },
    );
    expect(track.duration).toBe(10);
    expect(track.valueAt(7)).toBe(9);
  });

  it("starts from `from` when the first keyframe is later than 0", () => {
    const track = new Keyframes([{ at: 1, value: 100 }], { from: 0 });
    expect(track.valueAt(0.5)).toBeCloseTo(50, 9);
  });

  it("blends colours in the chosen space and points per component", () => {
    const rgb = new Keyframes(["#ff0000", "#0000ff"], { duration: 1 });
    expect(rgb.valueAt(0.5)).toBe("rgba(128, 0, 128, 1)");
    const hsl = new Keyframes(["#ff0000", "#0000ff"], { duration: 1, colorSpace: "hsl" });
    expect(hsl.valueAt(0.5)).not.toBe(rgb.valueAt(0.5));

    const points = new Keyframes(
      [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
      { duration: 1 },
    );
    expect(points.valueAt(0.5)).toEqual({ x: 5, y: 10 });
  });

  it("applies the default easing", () => {
    const track = new Keyframes([0, 100], { duration: 1, easing: Easing.easeIn });
    expect(track.valueAt(0.5)).toBeCloseTo(25, 9);
  });

  it("rejects keyframes that cannot be placed", () => {
    expect(() => new Keyframes([])).toThrow(LazyError);
    expect(() => new Keyframes([1, 2])).toThrow(/duration/);
    expect(() => new Keyframes([{ value: 1 } as any, { at: 1, value: 2 }])).toThrow(LazyError);
    expect(() => new Keyframes([{ at: 1, offset: 0.5, value: 1 }])).toThrow(/exactly one/);
    expect(() => new Keyframes([{ offset: 1, value: 1 }])).toThrow(/duration/);
    expect(() => new Keyframes([{ at: -1, value: 1 }])).toThrow(/invalid time/);
    expect(() => new Keyframes([{ at: 3, value: 1 }], { duration: 2 })).toThrow(
      /after the duration/,
    );
    expect(() => new Keyframes([{ at: 0, value: 1 }, 5 as any])).toThrow(/not both/);
  });
});

describe("signal.keyframes", () => {
  it("plays through the keyframes and ends on the last one", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(
      x.keyframes([
        { at: 0, value: 0 },
        { at: 0.5, value: 100 },
        { at: 1, value: 40 },
      ]),
    );
    scheduler.update(0);
    scheduler.update(0.25);
    expect(x.value()).toBeCloseTo(50, 5);
    scheduler.update(0.5);
    expect(x.value()).toBeCloseTo(100, 5);
    scheduler.update(0.75);
    expect(x.value()).toBeCloseTo(70, 5);
    scheduler.update(1);
    expect(x.value()).toBe(40);
    expect(x.velocity()).toBe(0);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("starts from the current value when the first keyframe is not at 0", () => {
    const x = createSignal(20);
    const scheduler = new ThreadScheduler();
    scheduler.add(x.keyframes([{ at: 1, value: 120 }]));
    scheduler.update(0);
    scheduler.update(0.5);
    expect(x.value()).toBeCloseTo(70, 5);
  });

  it("sets the first keyframe before the first frame", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(
      x.keyframes([
        { at: 0, value: 30 },
        { at: 1, value: 60 },
      ]),
    );
    scheduler.update(0);
    expect(x.value()).toBe(30);
  });

  it("is the same at any frame rate", () => {
    const frames = [
      { at: 0, value: 0 },
      { at: 0.4, value: 100, easing: Easing.easeOutCubic },
      { at: 1, value: 30 },
    ];
    const values = [30, 60, 144].map((fps) => {
      const x = createSignal(0);
      return playAt(x, fps, 0.5, () => x.keyframes(frames));
    });
    expect(values[1]).toBeCloseTo(values[0], 9);
    expect(values[2]).toBeCloseTo(values[0], 9);
  });

  it("reports its length and complains early about bad keyframes", () => {
    const x = createSignal(0);
    expect(durationOf(x.keyframes([0, 1, 2], { duration: 3 }))).toBe(3);
    expect(() => x.keyframes([])).toThrow(LazyError);
  });

  it("can be scrubbed on a scene", async () => {
    const x = createSignal(0);
    const box = new Morph({ color: "#f00", size: { width: 5, height: 5 }, position: { x, y: 0 } });
    const scene = new Scene(50, 10, { adapter });
    scene.load(new Group({}).add(box));
    scene.addAnimation(() =>
      x.keyframes([
        { at: 0, value: 0 },
        { at: 1, value: 100 },
        { at: 2, value: 0 },
      ]),
    );
    await scene.renderFrame(1.5);
    expect(box.props.position?.x).toBeCloseTo(50, 5);
    await scene.renderFrame(0.25);
    expect(box.props.position?.x).toBeCloseTo(25, 5);
    await scene.renderFrame(1);
    expect(box.props.position?.x).toBeCloseTo(100, 5);
  });
});

describe("easing tools", () => {
  it("cubicBezier matches CSS `ease` and the identity", () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.4, 0.9]) expect(linear(t)).toBeCloseTo(t, 5);
  });

  it("cubicBezier rejects an x outside 0..1", () => {
    expect(() => cubicBezier(2, 0, 0.5, 1)).toThrow(RangeError);
  });

  it("steps jumps in whole steps", () => {
    const end = steps(4);
    expect(end(0)).toBe(0);
    expect(end(0.24)).toBe(0);
    expect(end(0.26)).toBe(0.25);
    expect(end(1)).toBe(1);
    const start = steps(4, "start");
    expect(start(0.01)).toBe(0.25);
    expect(() => steps(0)).toThrow(RangeError);
  });
});

describe("animation lengths", () => {
  it("are known for the animations LazyCanvas makes", () => {
    const x = createSignal(0);
    expect(durationOf(x.to(1, 2))).toBe(2);
    expect(durationOf(waitFor(0.5))).toBe(0.5);
    expect(durationOf(chain(x.to(1, 2), waitFor(0.5)))).toBe(2.5);
    expect(durationOf(all(x.to(1, 2), waitFor(3)))).toBe(3);
    expect(durationOf(delay(1, x.to(1, 2)))).toBe(3);
  });

  it("are unknown for a generator written by hand", () => {
    const x = createSignal(0);
    function* custom() {
      yield* x.to(1, 1);
    }
    expect(durationOf(custom())).toBeUndefined();
    expect(durationOf(chain(custom(), waitFor(1)))).toBeUndefined();
  });
});

describe("Timeline positions", () => {
  /** Samples a signal at the given times while a timeline plays. */
  function sample(
    build: (s: Record<string, Signal<number>>) => ReturnType<typeof timeline>,
    times: number[],
  ) {
    const signals = { a: createSignal(0), b: createSignal(0), c: createSignal(0) };
    const scheduler = new ThreadScheduler();
    scheduler.add(build(signals).play());
    scheduler.update(0);
    return times.map((t) => {
      scheduler.update(t);
      return { a: signals.a.value(), b: signals.b.value(), c: signals.c.value() };
    });
  }

  it("appends to the end by default", () => {
    const [atOne, atTwo, atThree] = sample(
      ({ a, b }) => timeline().add(a.to(10, 1)).add(b.to(10, 1)),
      [1, 1.5, 2],
    );
    expect(atOne.a).toBe(10);
    expect(atOne.b).toBe(0);
    expect(atTwo.b).toBeCloseTo(5, 5);
    expect(atThree.b).toBe(10);
  });

  it('puts "<" together with the previous animation and ">" after it', () => {
    const [half] = sample(
      ({ a, b, c }) => timeline().add(a.to(10, 2)).add(b.to(10, 2), "<").add(c.to(10, 1), ">"),
      [1],
    );
    expect(half.a).toBeCloseTo(5, 5);
    expect(half.b).toBeCloseTo(5, 5);
    expect(half.c).toBe(0);
  });

  it("shifts with += and -=", () => {
    const [t1, t2] = sample(
      ({ a, b }) => timeline().add(a.to(10, 2)).add(b.to(10, 2), "-=1"),
      [1, 2],
    );
    expect(t1.b).toBe(0);
    expect(t2.b).toBeCloseTo(5, 5);

    const [gap] = sample(({ a, b }) => timeline().add(a.to(10, 1)).add(b.to(10, 1), "+=1"), [1.5]);
    expect(gap.b).toBe(0);
  });

  it("offsets from the previous start and end", () => {
    const [t] = sample(
      ({ a, b, c }) =>
        timeline().add(a.to(10, 2)).add(b.to(10, 1), "<+=1").add(c.to(10, 1), ">-=1"),
      [1.5],
    );
    expect(t.b).toBeCloseTo(5, 5); // starts at 1
    expect(t.c).toBeCloseTo(5, 5); // previous (b) ends at 2, so c starts at 1
  });

  it("places animations at labels", () => {
    const [t] = sample(
      ({ a, b }) => timeline().add(a.to(10, 1)).label("mid", 3).add(b.to(10, 1), "mid+=1"),
      [4.5],
    );
    expect(t.b).toBeCloseTo(5, 5);
  });

  it("runs a nested timeline as one animation", () => {
    const [t] = sample(
      ({ a, b, c }) => {
        const inner = timeline().add(a.to(10, 1)).add(b.to(10, 1));
        return timeline().add(inner).add(c.to(10, 1));
      },
      [2.5],
    );
    expect(t.a).toBe(10);
    expect(t.b).toBe(10);
    expect(t.c).toBeCloseTo(5, 5);
  });

  it("knows its own length", () => {
    const x = createSignal(0);
    expect(timeline().duration).toBe(0);
    expect(timeline().add(x.to(1, 1)).add(x.to(1, 2), "<").duration).toBe(2);
    expect(timeline().add(x.to(1, 1)).add(x.to(1, 2)).duration).toBe(3);
  });

  it("refuses positions it cannot work out", () => {
    const x = createSignal(0);
    function* custom() {
      yield* x.to(1, 1);
    }
    const tl = timeline().add(custom(), 0);
    expect(tl.duration).toBeUndefined();
    expect(() => tl.add(x.to(1, 1))).toThrow(/unknown length/);
    expect(() => tl.add(x.to(1, 1), ">")).toThrow(/unknown length/);
    // An absolute position and after() still work.
    expect(() => tl.add(x.to(1, 1), 5)).not.toThrow();

    expect(() => timeline().add(x.to(1, 1), "later")).toThrow(/no label/);
    expect(() => timeline().add(x.to(1, 1), "<")).toThrow(/before it/);
    expect(() => timeline().add(x.to(1, 1), "-=1")).toThrow(/before the start/);
    expect(() => timeline().add(x.to(1, 1), "??")).toThrow(/cannot read/);
    expect(() => timeline().add(x.to(1, 1), -2)).toThrow(LazyError);
  });

  it("lets after() follow an animation of unknown length", () => {
    const x = createSignal(0);
    const y = createSignal(0);
    function* custom() {
      yield* x.to(10, 1);
    }
    const scheduler = new ThreadScheduler();
    scheduler.add(timeline().after(custom()).after(y.to(10, 1)).play());
    scheduler.update(0);
    scheduler.update(1.5);
    expect(x.value()).toBe(10);
    expect(y.value()).toBeCloseTo(5, 1);
  });

  it("works with springs and keyframes in the same timeline", () => {
    const x = createSignal(0);
    const y = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(
      timeline()
        .add(x.spring(100))
        .add(y.keyframes([0, 50, 0], { duration: 1 }), "<")
        .play(),
    );
    scheduler.update(0);
    scheduler.update(0.5);
    expect(y.value()).toBeCloseTo(50, 5);
    scheduler.update(5);
    expect(x.value()).toBe(100);
    expect(y.value()).toBe(0);
  });
});

describe("Playhead", () => {
  it("only moves while it plays", () => {
    const head = new Playhead({ duration: 10 });
    expect(head.tick(1)).toBe(0);
    head.play();
    expect(head.tick(1)).toBe(1);
    head.pause();
    expect(head.tick(5)).toBe(1);
  });

  it("scales time by speed and can play backwards", () => {
    const head = new Playhead({ duration: 10, speed: 2, playing: true });
    expect(head.tick(1)).toBe(2);
    head.reverse();
    expect(head.tick(0.5)).toBe(1);
    head.speed = -1;
    head.reverse(); // reversed twice: negative speed alone plays backwards
    expect(head.tick(0.25)).toBeCloseTo(0.75, 9);
  });

  it("stops at the end, and starts over when played again", () => {
    const head = new Playhead({ duration: 2, playing: true });
    expect(head.tick(5)).toBe(2);
    expect(head.playing).toBe(false);
    expect(head.ended).toBe(true);
    head.play();
    expect(head.time).toBe(0);
    expect(head.ended).toBe(false);
  });

  it("stops at the start when reversed", () => {
    const head = new Playhead({ duration: 2, time: 1, playing: true }).reverse();
    expect(head.tick(5)).toBe(0);
    expect(head.ended).toBe(true);
  });

  it("loops, also across several lengths in one long frame", () => {
    const head = new Playhead({ duration: 2, loop: true, playing: true });
    expect(head.tick(2.5)).toBeCloseTo(0.5, 9);
    expect(head.tick(4.25)).toBeCloseTo(0.75, 9);
    expect(head.playing).toBe(true);
  });

  it("turns around at the ends when yoyo", () => {
    const head = new Playhead({ duration: 2, loop: true, yoyo: true, playing: true });
    expect(head.tick(2.5)).toBeCloseTo(1.5, 9); // forwards to 2, then 0.5 back
    expect(head.tick(1)).toBeCloseTo(0.5, 9);
    expect(head.tick(1)).toBeCloseTo(0.5, 9); // back to 0 after 0.5, then 0.5 forwards
    expect(head.tick(1)).toBeCloseTo(1.5, 9);
  });

  it("seeks within the animation", () => {
    const head = new Playhead({ duration: 4 });
    expect(head.seek(3).time).toBe(3);
    expect(head.seek(99).time).toBe(4);
    expect(head.seek(-1).time).toBe(0);
  });

  it("rejects a bad duration", () => {
    expect(() => new Playhead({ duration: -1 })).toThrow(LazyError);
    expect(() => new Playhead({ duration: Number.NaN })).toThrow(LazyError);
  });
});

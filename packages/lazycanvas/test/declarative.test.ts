import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import {
  Easing,
  Group,
  LazyError,
  Morph,
  Scene,
  type Signal,
  type ThreadGenerator,
  ThreadScheduler,
  all,
  any,
  calculateDuration,
  chain,
  createSignal,
  delay,
  loop,
  loopFor,
  solveSpring,
  stagger,
  timeline,
  waitFor,
} from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

/** A generator that counts how many times the scheduler resumed it. */
function counted(inner: ThreadGenerator) {
  const stats = { resumes: 0 };
  const wrapper: ThreadGenerator = {
    next: (value) => {
      stats.resumes++;
      return inner.next(value as number);
    },
    return: (value) => inner.return(value),
    throw: (error) => inner.throw(error),
    [Symbol.iterator]() {
      return wrapper;
    },
  } as ThreadGenerator;
  return { wrapper, stats };
}

/** Values of signals at the times given, with the animation updated to each in turn. */
function sample(run: () => ThreadGenerator, signals: Array<Signal<any>>, times: number[]) {
  const scheduler = new ThreadScheduler();
  scheduler.add(run());
  scheduler.update(0);
  return times.map((time) => {
    scheduler.update(time);
    return signals.map((s) => s.value());
  });
}

describe("animations that sleep until they are due", () => {
  it("are resumed when something starts or ends, not on every step", () => {
    const x = createSignal(0);
    const { wrapper, stats } = counted(chain(x.to(100, 10), x.to(0, 10)));
    const scheduler = new ThreadScheduler();
    scheduler.add(wrapper);
    for (let frame = 0; frame <= 1500; frame++) scheduler.update(frame / 60); // 25 s of frames

    // Started, the first ended, the second ended. Before this it was one resume for every 1/240 s.
    expect(stats.resumes).toBeLessThanOrEqual(3);
    expect(x.value()).toBe(0);
  });

  it("make many tweens at once cost the moments they end at", () => {
    const signals = Array.from({ length: 50 }, () => createSignal(0));
    const { wrapper, stats } = counted(all(...signals.map((s, i) => s.to(10, 1 + i * 0.1))));
    const scheduler = new ThreadScheduler();
    scheduler.add(wrapper);
    for (let frame = 0; frame <= 600; frame++) scheduler.update(frame / 60);
    expect(stats.resumes).toBeLessThanOrEqual(52);
    expect(signals.every((s) => s.value() === 10)).toBe(true);
  });

  it("give exact values between the points of the grid", () => {
    const x = createSignal(0);
    const [[a], [b]] = sample(() => x.to(100, 1), [x], [0.1234, 0.7777]);
    expect(a).toBeCloseTo(12.34, 10);
    expect(b).toBeCloseTo(77.77, 10);
  });

  it("hand over from one animation to the next at the exact moment, so nothing is lost", () => {
    const x = createSignal(0);
    // 0.3 s up, then 0.3 s down: at 0.45 s it is exactly half way down.
    const [[mid], [end]] = sample(() => chain(x.to(10, 0.3), x.to(0, 0.3)), [x], [0.45, 0.6]);
    expect(mid).toBeCloseTo(5, 10);
    expect(end).toBe(0);
  });

  it("do not drift over many iterations of a loop", () => {
    const x = createSignal(0);
    const exact = (t: number) => {
      const p = t % 0.6;
      return p < 0.37 ? (100 * p) / 0.37 : 100 * (1 - (p - 0.37) / 0.23);
    };
    const times = [1.0123, 2.7, 5.917, 11.111, 59.9, 123.456];
    const values = sample(() => loop(() => chain(x.to(100, 0.37), x.to(0, 0.23))), [x], times);
    values.forEach(([v], i) => expect(v, `at ${times[i]} s`).toBeCloseTo(exact(times[i]), 6));
  });

  it("end up in the same state however time is advanced to a moment", () => {
    const build = () => {
      const x = createSignal(0);
      const y = createSignal("#102030");
      const z = createSignal(5);
      const run = () =>
        all(
          loop(() => chain(x.to(100, 0.37, { easing: Easing.easeInOutCubic }), x.to(0, 0.23))),
          chain(waitFor(0.4), y.to("#ff8800", 0.9)),
          delay(0.15, z.spring(80, "wobbly")),
        );
      return { signals: [x, y, z], run };
    };
    const state = (advance: (s: ThreadScheduler) => void) => {
      const { signals, run } = build();
      const scheduler = new ThreadScheduler();
      scheduler.add(run());
      advance(scheduler);
      return signals.map((s) => s.value());
    };

    const direct = state((s) => s.update(2.9));
    const small = state((s) => {
      for (let t = 0; t <= 2.9 - 1e-9; t += 0.0173) s.update(t);
      s.update(2.9);
    });
    const big = state((s) => {
      s.update(0.5);
      s.update(1.7);
      s.update(2.9);
    });
    expect(small).toEqual(direct);
    expect(big).toEqual(direct);
  });
});

describe("animations that are polled", () => {
  it("still run, on the grid, with the time that passed", () => {
    const deltas: number[] = [];
    let count = 0;
    const scheduler = new ThreadScheduler();
    scheduler.add(
      (function* () {
        for (;;) {
          count++;
          const delta = yield;
          deltas.push(delta as number);
        }
      })(),
    );
    scheduler.update(0);
    scheduler.update(1);
    expect(count).toBeGreaterThanOrEqual(240);
    expect(count).toBeLessThanOrEqual(241);
    expect(deltas.every((d) => Math.abs(d - 1 / 240) < 1e-6)).toBe(true);
  });

  it("share a scheduler with animations that sleep without disturbing them", () => {
    const x = createSignal(0);
    let ticks = 0;
    const scheduler = new ThreadScheduler();
    scheduler.add(x.to(100, 1));
    scheduler.add(
      (function* () {
        for (;;) {
          ticks++;
          yield;
        }
      })(),
    );
    scheduler.update(0);
    scheduler.update(0.4137);
    expect(x.value()).toBeCloseTo(41.37, 10);
    expect(ticks).toBeGreaterThan(90);
    scheduler.update(2);
    expect(x.value()).toBe(100);
  });

  it("are carried along inside all()", () => {
    const x = createSignal(0);
    let ticks = 0;
    const scheduler = new ThreadScheduler();
    scheduler.add(
      all(
        x.to(10, 0.5),
        (function* () {
          while (ticks < 60) {
            ticks++;
            yield;
          }
        })(),
      ),
    );
    scheduler.update(0.5);
    expect(x.value()).toBe(10);
    expect(ticks).toBeGreaterThanOrEqual(59);
    scheduler.update(1);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });
});

describe("stopping animations", () => {
  it("clearing leaves what they animate where it was", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(x.to(100, 1));
    scheduler.update(0.5);
    scheduler.clear();
    scheduler.update(0.9);
    expect(x.value()).toBeCloseTo(50, 10);
    scheduler.update(5);
    expect(x.value()).toBeCloseTo(50, 10);
  });

  it("removing one thread leaves the others running", () => {
    const x = createSignal(0);
    const y = createSignal(0);
    const first = x.to(100, 1);
    const scheduler = new ThreadScheduler();
    scheduler.add(first);
    scheduler.add(y.to(100, 1));
    scheduler.update(0.5);
    scheduler.remove(first);
    scheduler.update(1);
    expect(x.value()).toBeCloseTo(50, 10);
    expect(y.value()).toBe(100);
  });

  it("resetting stops everything and sets the time back", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(x.to(100, 1));
    scheduler.update(0.5);
    scheduler.reset();
    expect(scheduler.hasActiveThreads()).toBe(false);
    expect(scheduler.getTime()).toBe(0);
    scheduler.update(2);
    expect(x.value()).toBeCloseTo(50, 10);
  });

  it("any() stops the others when the first is done, and they stay where they were", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const c = createSignal(0);
    const [at1, at3] = sample(
      () => chain(any(a.to(10, 0.8), b.to(10, 2)), c.to(10, 0.5)),
      [a, b, c],
      [1.3, 3],
    );
    expect(at1[0]).toBe(10);
    expect(at1[1]).toBeCloseTo(4, 10); // 0.8 s of 2
    expect(at1[2]).toBe(10); // began at 0.8 s exactly
    expect(at3[1]).toBeCloseTo(4, 10); // and has not moved since
  });

  it("loopFor() stops at its time, in the middle of an iteration", () => {
    const x = createSignal(0);
    const [at35, later] = sample(
      () => loopFor(() => chain(x.to(100, 1), x.to(0, 1)), 3.5),
      [x],
      [3.5, 9],
    );
    expect(at35[0]).toBeCloseTo(50, 10);
    expect(later[0]).toBeCloseTo(50, 10);
  });

  it("loopFor() with a body that takes no time says so instead of hanging", () => {
    const scheduler = new ThreadScheduler();
    scheduler.add(loopFor(() => waitFor(0), 1));
    expect(() => scheduler.update(1)).toThrow(LazyError);
  });
});

describe("several animations on one signal", () => {
  it("the one that started last takes over, and the first ending does not undo it", () => {
    const x = createSignal(0);
    const [at12, at2] = sample(
      () => all(x.to(10, 1), chain(waitFor(0.5), x.to(0, 1))),
      [x],
      [1.2, 2],
    );
    // The second started at 0.5 s from 5 and ends at 1.5 s: at 1.2 s it has 70% of its way done.
    expect(at12[0]).toBeCloseTo(1.5, 10);
    expect(at2[0]).toBe(0);
  });

  it("setting the value while it is animated stops the animation", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(x.to(100, 1));
    scheduler.update(0.5);
    x.set(7);
    scheduler.update(0.8);
    expect(x.value()).toBe(7);
    scheduler.update(3);
    expect(x.value()).toBe(7);
  });

  it("the speed a tween ends at is what a spring continues from", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(chain(x.to(100, 1), x.spring(200, "default")));
    scheduler.update(1);
    expect(x.velocity()).toBeCloseTo(100, 0); // moving at 100 units a second when the tween ends
    scheduler.update(1 + 1 / 240);
    expect(x.value() - 100).toBeGreaterThan(0.38);
  });
});

describe("exactness of the things built from them", () => {
  it("springs give the closed-form motion at any time", () => {
    const x = createSignal(0);
    const motion = solveSpring(0, 100, "wobbly");
    const times = [0.1, 0.3137, 0.9];
    const values = sample(() => x.spring(100, "wobbly"), [x], times);
    values.forEach(([v], i) => expect(v).toBeCloseTo(motion.position(times[i]), 9));
  });

  it("stagger starts each animation at its own exact time", () => {
    const signals = [createSignal(0), createSignal(0), createSignal(0)];
    const values = sample(
      () =>
        stagger(
          0.0123,
          signals.map((s) => s.to(10, 0.8)),
        ),
      signals,
      [0.1123],
    );
    expect(values[0][0]).toBeCloseTo(((0.1123 - 0) / 0.8) * 10, 9);
    expect(values[0][1]).toBeCloseTo(((0.1123 - 0.0123) / 0.8) * 10, 9);
    expect(values[0][2]).toBeCloseTo(((0.1123 - 0.0246) / 0.8) * 10, 9);
  });

  it("a timeline starts its entries at their positions", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const values = sample(
      () => timeline().add(a.to(10, 1)).add(b.to(10, 1), "<+=0.3137").play(),
      [a, b],
      [0.5, 0.7137],
    );
    // `b` starts 0.3137 s after `a` does, and takes a second.
    expect(values[0][1]).toBeCloseTo((0.5 - 0.3137) * 10, 9);
    expect(values[1][1]).toBeCloseTo((0.7137 - 0.3137) * 10, 9);
  });

  it("calculateDuration gives the exact length", () => {
    const x = createSignal(0);
    expect(calculateDuration(() => chain(x.to(1, 0.3), waitFor(0.45)))).toBeCloseTo(0.75, 12);
  });
});

describe("the history of animations", () => {
  it("takes a few entries for an animation however long it runs", () => {
    const x = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.watch(x);
    scheduler.add(x.to(100, 600));
    for (let frame = 0; frame <= 600 * 60; frame += 30) scheduler.update(frame / 60);
    expect(scheduler.historySize).toBeLessThanOrEqual(5);
  });

  it("gives back every earlier moment exactly, in any order", () => {
    const x = createSignal(0);
    const y = createSignal("#000000");
    const scheduler = new ThreadScheduler();
    scheduler.watch(x);
    scheduler.watch(y);
    scheduler.add(loop(() => all(chain(x.to(100, 0.37), x.to(0, 0.23)), y.to("#ff00ff", 0.5))));

    const times = Array.from({ length: 60 }, (_, i) => i * 0.0971);
    const forward = times.map((t) => {
      scheduler.update(t);
      return [x.value(), y.value()];
    });

    const order = times.map((_, i) => i).sort((a, b) => ((a * 7919) % 61) - ((b * 7919) % 61));
    for (const i of order) {
      scheduler.update(times[i]);
      expect([x.value(), y.value()], `at ${times[i]}`).toEqual(forward[i]);
    }
  });

  it("goes a long way ahead by running the moments, not the steps", () => {
    const signals = Array.from({ length: 300 }, () => createSignal(0));
    const scheduler = new ThreadScheduler({ history: false });
    signals.forEach((s, i) =>
      scheduler.add(loop(() => chain(s.to(100, 1 + (i % 7) * 0.1), s.to(0, 1 + (i % 5) * 0.1)))),
    );
    const start = performance.now();
    scheduler.update(600); // ten minutes of 300 signals, which took 144000 steps of every one of them
    expect(performance.now() - start).toBeLessThan(3000);
    expect(signals.every((s) => s.value() >= 0 && s.value() <= 100)).toBe(true);
  });
});

describe("in a scene", () => {
  it("shows the exact value at any time given to renderFrame", async () => {
    const x = createSignal(0);
    const box = new Morph({ color: "#f00", size: { width: 5, height: 5 }, position: { x, y: 0 } });
    const scene = new Scene(200, 20, { adapter });
    scene.load(new Group({}).add(box));
    scene.addAnimation(() => x.to(100, 1));
    await scene.renderFrame(0.123);
    expect(box.props.position?.x).toBeCloseTo(12.3, 10);
    await scene.renderFrame(0.5);
    await scene.renderFrame(0.0371);
    expect(box.props.position?.x).toBeCloseTo(3.71, 10);
  });

  it("measures the duration of animations exactly and leaves the signals alone", () => {
    const x = createSignal(0);
    const scene = new Scene(50, 20, { adapter });
    scene.load(
      new Group({}).add(
        new Morph({ color: "#f00", size: { width: 5, height: 5 }, position: { x, y: 0 } }),
      ),
    );
    scene.addAnimation(() => chain(x.to(100, 0.3), waitFor(0.45)));
    expect(scene.duration).toBeCloseTo(0.75, 12);
    expect(x.value()).toBe(0);
  });
});

describe("Signal.update by hand", () => {
  it("steps an animation given to run()", () => {
    const x = createSignal(0);
    x.run(x.to(10, 1));
    expect(x.update(0)).toBe(true);
    expect(x.update(0.5)).toBe(true);
    expect(x.value()).toBeCloseTo(5, 10);
    expect(x.update(0.5)).toBe(false);
    expect(x.value()).toBe(10);
  });
});

describe("generators run without a scheduler", () => {
  it("say what is missing", () => {
    const x = createSignal(0);
    const gen = x.to(10, 1);
    expect(() => gen.next()).toThrow(/needs a clock/);
  });
});

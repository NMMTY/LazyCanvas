import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import {
  Easing,
  Group,
  LazyError,
  Morph,
  Scene,
  type Signal,
  SignalTrace,
  ThreadScheduler,
  all,
  chain,
  createSignal,
  timeline,
  waitFor,
} from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

/** Runs a scheduler through frames at `fps` until `until` seconds and returns the signal's value there. */
function playAt(
  fps: number,
  until: number,
  build: (s: Signal<number>) => Generator<any, void, any>,
) {
  const s = createSignal(0);
  const scheduler = new ThreadScheduler();
  scheduler.watch(s);
  scheduler.add(build(s));
  const frames = Math.round(until * fps);
  for (let i = 0; i <= frames; i++) scheduler.update(i / fps);
  return s.value();
}

/** A scene with one animated box; returns the box x at the given time. */
function makeScene(options: ConstructorParameters<typeof Scene>[2] = {}) {
  const x = createSignal(0);
  const box = new Morph({ color: "#f00", size: { width: 10, height: 10 }, position: { x, y: 0 } });
  const scene = new Scene(100, 20, { adapter, ...options });
  scene.load(new Group({}).add(box));
  return { scene, x, box };
}

const path = (x: Signal<number>) =>
  function* () {
    yield* x.to(100, 1);
    yield* waitFor(0.5);
    yield* x.to(0, 1, { easing: Easing.easeInOutCubic });
  };

describe("fixed time step", () => {
  it("gives the same values at 30, 60 and 144 fps", () => {
    const build = (s: Signal<number>) => chain(s.to(100, 0.3), s.to(0, 0.3), s.to(50, 0.4));
    const at30 = playAt(30, 1, build);
    const at60 = playAt(60, 1, build);
    const at144 = playAt(144, 1, build);
    expect(at60).toBeCloseTo(at30, 9);
    expect(at144).toBeCloseTo(at30, 9);
    expect(at30).toBe(50);
  });

  it("ends a tween exactly on its target, with no step left over", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(s.to(360, 1));
    scheduler.update(0);
    scheduler.update(1);
    expect(s.value()).toBe(360);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("does not lose the time left over when one animation hands over to the next", () => {
    // 1s tween followed by another one, sampled with a frame (0.3s) that does not divide 1s.
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(chain(s.to(100, 1), s.to(200, 1)));
    for (let t = 0; t <= 1.5 + 1e-9; t += 0.3) scheduler.update(t);
    scheduler.update(1.5);
    // 0.5s into the second tween, within one step of the exact value.
    expect(s.value()).toBeCloseTo(150, 0);
    expect(Math.abs(s.value() - 150)).toBeLessThan(1);
  });

  it("starts an animation at the time of the last update when it is added later", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.update(2);
    scheduler.add(s.to(10, 1));
    scheduler.update(2.5);
    expect(s.value()).toBeCloseTo(5, 5);
  });

  it("shows what an animation sets before its first wait on the first frame", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.watch(s);
    scheduler.add(
      (function* () {
        s.set(7);
        yield* waitFor(1);
      })(),
    );
    scheduler.update(0);
    expect(s.value()).toBe(7);
  });
});

describe("moving the timeline to any time", () => {
  const times = [0, 0.4, 1, 1.25, 2.5, 3, 0.2, 2.9, 1.5, 0, 3, 0.7];

  it("shows the same values as playing from the start, in any order", async () => {
    const { scene, x, box } = makeScene();
    scene.addAnimation(path(x));

    for (const t of times) {
      await scene.renderFrame(t);

      const reference = makeScene();
      reference.scene.addAnimation(path(reference.x));
      await reference.scene.renderFrame(t);

      expect(box.props.position?.x, `x at ${t}s`).toBeCloseTo(
        reference.box.props.position?.x as number,
        9,
      );
    }
  });

  it("goes back and then carries on running the animation", async () => {
    const { scene, x, box } = makeScene();
    scene.addAnimation(path(x));

    await scene.renderFrame(2);
    await scene.renderFrame(0.5);
    expect(box.props.position?.x).toBeCloseTo(50, 5);

    // Past what was simulated before: generators continue from where they stopped.
    await scene.renderFrame(3);
    expect(box.props.position?.x).toBe(0);
  });

  it("restores colour and point signals as well as numbers", async () => {
    const color = createSignal("#000000");
    const pos = createSignal({ x: 0, y: 0 });
    const box = new Morph({ color, size: { width: 10, height: 10 }, position: pos as any });
    const scene = new Scene(50, 50, { adapter });
    scene.load(new Group({}).add(box));
    scene.addAnimation(all(color.to("#ffffff", 1), pos.to({ x: 40, y: 20 }, 1)));

    await scene.renderFrame(1);
    expect(color.value()).toBe("#ffffff");
    await scene.renderFrame(0);
    expect(color.value()).toBe("#000000");
    expect(pos.value()).toEqual({ x: 0, y: 0 });
    await scene.renderFrame(0.5);
    expect(pos.value().x).toBeCloseTo(20, 5);
  });

  it("replays frame 0 after the animation has run, as the PNG exporter does", async () => {
    const { scene, x } = makeScene();
    scene.addAnimation(path(x));
    await scene.renderFrame(3);
    await scene.renderFrame(0);
    expect(x.value()).toBe(0);
  });

  it("refuses a new animation while another one is still running behind the cursor", async () => {
    const { scene, x } = makeScene();
    scene.addAnimation(path(x));
    await scene.renderFrame(1);
    await scene.renderFrame(0.2);
    expect(() => scene.addAnimation(waitFor(1))).toThrow(LazyError);
  });

  it("forks the timeline when nothing is running any more", async () => {
    const { scene, x, box } = makeScene();
    scene.addAnimation(x.to(100, 1));
    await scene.renderFrame(2); // finished
    await scene.renderFrame(0.5);
    expect(box.props.position?.x).toBeCloseTo(50, 5);

    scene.addAnimation(x.to(0, 1)); // continues from 0.5s
    await scene.renderFrame(1.5);
    expect(box.props.position?.x).toBeCloseTo(0, 5);
  });

  it("throws when going back with history turned off", async () => {
    const { scene, x } = makeScene({ history: false });
    scene.addAnimation(path(x));
    await scene.renderFrame(1);
    await expect(scene.renderFrame(0.5)).rejects.toThrow(/history is turned off/);
    // Going forwards and repeating a frame still work.
    await scene.renderFrame(1);
    await scene.renderFrame(2);
  });

  it("drops history older than maxSeconds and says so", async () => {
    const { scene, x } = makeScene({ history: { maxSeconds: 1 } });
    scene.addAnimation(
      (function* () {
        yield* x.to(1000, 10);
      })(),
    );
    for (let t = 0; t <= 5; t += 0.5) await scene.renderFrame(t);
    await expect(scene.renderFrame(0)).rejects.toThrow(/history before step/);
    await expect(scene.renderFrame(4.8)).resolves.toBeUndefined();
  });
});

describe("SignalTrace", () => {
  it("stores only the steps where a value changed", () => {
    const s = createSignal(0);
    const trace = new SignalTrace();
    trace.watch(s);
    for (let step = 1; step <= 100; step++) {
      if (step === 10) s.restore(5);
      trace.record(step);
    }
    s.restore(99);
    trace.restore(9);
    expect(s.value()).toBe(0);
    trace.restore(10);
    expect(s.value()).toBe(5);
    trace.restore(100);
    expect(s.value()).toBe(5);
  });
});

describe("Scene.duration", () => {
  it("adds up the animations added as functions", () => {
    const { scene, x } = makeScene();
    scene.addAnimation(() => chain(x.to(10, 1), waitFor(0.5)));
    expect(scene.duration).toBeCloseTo(1.5, 2);
  });

  it("is the longest of animations that run side by side", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const { scene } = makeScene();
    scene.addAnimation(() => a.to(1, 0.5));
    scene.addAnimation(() => b.to(1, 2));
    expect(scene.duration).toBeCloseTo(2, 2);
  });

  it("leaves the signals where they were", () => {
    const { scene, x } = makeScene();
    scene.addAnimation(() => x.to(100, 1));
    expect(scene.duration).toBeCloseTo(1, 2);
    expect(x.value()).toBe(0);
  });

  it("ignores generators that were created already, and is 0 with none", () => {
    const { scene, x } = makeScene();
    expect(scene.duration).toBe(0);
    scene.addAnimation(x.to(100, 3));
    expect(scene.duration).toBe(0);
  });
});

describe("Timeline", () => {
  it("starts `after` animations when the previous one is done", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    const seen: number[] = [];
    scheduler.add(timeline().after(s.to(10, 1)).after(s.to(30, 1)).after(s.to(0, 2)).play());
    scheduler.update(0);
    for (const t of [0.5, 1, 1.5, 2, 3, 4]) {
      scheduler.update(t);
      seen.push(s.value());
    }
    expect(seen[0]).toBeCloseTo(5, 5);
    expect(seen[1]).toBeCloseTo(10, 5);
    expect(seen[2]).toBeCloseTo(20, 5);
    expect(seen[3]).toBeCloseTo(30, 5);
    expect(seen[4]).toBeCloseTo(15, 5);
    expect(seen[5]).toBe(0);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("starts `at` animations at their time, side by side with others", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(timeline().at(0, a.to(10, 2)).at(1, b.to(10, 1)).play());
    scheduler.update(0);
    scheduler.update(1);
    expect(a.value()).toBeCloseTo(5, 5);
    expect(b.value()).toBe(0);
    scheduler.update(1.5);
    expect(b.value()).toBeCloseTo(5, 5);
    scheduler.update(2);
    expect(a.value()).toBe(10);
    expect(b.value()).toBe(10);
  });

  it("lets seek() pin the next `after` to a time", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(timeline().after(waitFor(0.5)).seek(2).after(s.to(10, 1)).play());
    scheduler.update(0);
    scheduler.update(1.9);
    expect(s.value()).toBe(0);
    scheduler.update(2.5);
    expect(s.value()).toBeCloseTo(5, 5);
  });
});

describe("matrix transform", () => {
  it("accepts a matrix with zeros in it", async () => {
    const box = new Morph({
      color: "#f00",
      size: { width: 10, height: 10 },
      transform: { matrix: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 0 } },
    });
    const scene = new Scene(50, 50, { adapter });
    scene.load(new Group({}).add(box));
    await expect(scene.renderFrame(0)).resolves.toBeUndefined();
  });

  it("still rejects a matrix with a missing component", async () => {
    const box = new Morph({
      color: "#f00",
      size: { width: 10, height: 10 },
      transform: { matrix: { a: 1, b: 0, c: 0, d: 1, e: 5 } },
    });
    const scene = new Scene(50, 50, { adapter });
    scene.load(new Group({}).add(box));
    await expect(scene.renderFrame(0)).rejects.toThrow(/valid matrix/);
  });
});

describe("ThreadScheduler with animations that start animations", () => {
  it("starts an animation added by a running one on the next step, with its first step intact", () => {
    const scheduler = new ThreadScheduler();
    const child = createSignal(0);
    scheduler.add(
      (function* () {
        yield* waitFor(0.5);
        scheduler.add(child.to(10, 1));
      })(),
    );
    scheduler.update(0);
    scheduler.update(1.5);
    expect(child.value()).toBeCloseTo(10, 5);
    scheduler.update(1.25);
    expect(child.value()).toBeGreaterThan(0);
  });
});

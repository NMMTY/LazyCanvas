// Runs ONE benchmark scenario and prints its result as a line of JSON.
//
//   node --expose-gc scripts/bench/run-scenario.mjs <scenario>
//
// Usually started by scripts/bench/bench.mjs, once per scenario so that every one gets a fresh process
// (no shared JIT state or heap). The library is loaded from `<LAZYCANVAS_ROOT>/packages/*/dist`, which is
// this checkout unless the variable points at another one (that is how a baseline is compared).
//
// Environment: BENCH_OPTS (JSON merged into the Scene options), BENCH_NOANIM=1 (do not start animations),
// BENCH_NOROT=1 (leave the transforms off the polygons of the "complex" scene).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(
  process.env.LAZYCANVAS_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".."),
);
const load = (path) => {
  const file = join(root, path);
  if (!existsSync(file))
    throw new Error(`${file} is missing: build that checkout first (pnpm build)`);
  return import(pathToFileURL(file).href);
};

const { NodeCanvasAdapter } = await load("packages/adapter-node/dist/index.mjs");
const { createFakeAdapter } = await import("./fake-canvas.mjs");
const lib = await load("packages/lazycanvas/dist/index.mjs");
const { Fonts } = await load("packages/lazycanvas/dist/fonts/index.mjs");
const {
  Bezier,
  Easing,
  Group,
  Line,
  Morph,
  Polygon,
  Scene,
  Text,
  ThreadScheduler,
  all,
  chain,
  createSignal,
  loop,
  waitFor,
} = lib;

// BENCH_FAKE=1: a canvas that draws nothing, to measure the library without the drawing (see fake-canvas.mjs).
// Nothing else keeps the process alive while the layout engine (WebAssembly) is being set up.
const keepAlive = process.env.BENCH_FAKE ? setInterval(() => {}, 1000) : null;
const adapter = process.env.BENCH_FAKE
  ? createFakeAdapter(new NodeCanvasAdapter())
  : new NodeCanvasAdapter();
const scenario = process.argv[2];
const now = () => Number(process.hrtime.bigint()) / 1e6;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const palette = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const font = (size) => ({ family: "Geist", size, weight: 600 });

const morph = (o) =>
  new Morph({
    color: o.color,
    size: { width: o.w, height: o.h, radius: { all: o.r ?? 0 } },
    position: { x: o.x, y: o.y },
    centring: "none",
    opacity: o.opacity,
    shadow: o.shadow,
    filter: o.filter,
  });
const text = (t, x, y, size, color = "#e2e8f0") =>
  new Text({ text: t, color, font: font(size), position: { x, y }, centring: "none" });

/** Each scene returns { scene, setup(scene) } where setup registers its animations. */
function build(name, opts = {}) {
  const r = rng(42);
  const pick = () => palette[Math.floor(r() * palette.length)];
  const animations = [];
  const sceneOpts = { adapter, ...JSON.parse(process.env.BENCH_OPTS ?? "{}"), ...opts.scene };

  if (name === "simple") {
    const scene = new Scene(800, 450, sceneOpts);
    const x = createSignal(40);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    scene.load(
      new Group({}).add(
        morph({ color: "#0f172a", w: 800, h: 450, x: 0, y: 0 }),
        morph({
          color: "#1e293b",
          w: 720,
          h: 300,
          x: 40,
          y: 70,
          r: 20,
          shadow: { color: "#00000088", blur: 20, offsetX: 0, offsetY: 8 },
        }),
        text("LazyCanvas", 70, 110, 44, "#ffffff"),
        text("declarative canvas rendering", 70, 170, 22),
        new Morph({
          color: "#3b82f6",
          size: { width: 48, height: 48, radius: { all: 12 } },
          position: { x, y: 260 },
          centring: "none",
        }),
      ),
    );
    animations.push(() =>
      loop(() =>
        chain(
          x.to(700, 1.5, { easing: Easing.easeInOutCubic }),
          x.to(40, 1.5, { easing: Easing.easeInOutCubic }),
        ),
      ),
    );
    return { scene, animations, layers: 5, signals: 1 };
  }

  if (name === "medium" || name === "medium-cache") {
    const scene = new Scene(1280, 720, {
      ...sceneOpts,
      cache: name === "medium-cache" ? true : undefined,
    });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    const layers = [morph({ color: "#0b1220", w: 1280, h: 720, x: 0, y: 0 })];
    let signals = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12; col++) {
        const index = row * 12 + col;
        const baseX = 40 + col * 100;
        const baseY = 60 + row * 90;
        if (index % 2 === 0) {
          const x = createSignal(baseX);
          const op = createSignal(0.4);
          signals += 2;
          layers.push(
            new Morph({
              color: pick(),
              size: { width: 80, height: 70, radius: { all: 12 } },
              position: { x, y: baseY },
              centring: "none",
              opacity: op,
            }),
          );
          animations.push(() =>
            loop(() =>
              all(
                chain(
                  x.to(baseX + 16, 0.8 + (index % 5) * 0.1, { easing: Easing.easeInOutSine }),
                  x.to(baseX, 0.8 + (index % 5) * 0.1, { easing: Easing.easeInOutSine }),
                ),
                chain(op.to(1, 0.8), op.to(0.4, 0.8)),
              ),
            ),
          );
        } else {
          layers.push(
            morph({
              color: pick(),
              w: 80,
              h: 70,
              x: baseX,
              y: baseY,
              r: 12,
              shadow:
                index % 9 === 1
                  ? { color: "#00000099", blur: 12, offsetX: 0, offsetY: 4 }
                  : undefined,
            }),
          );
        }
      }
    }
    for (let i = 0; i < 20; i++)
      layers.push(text(`Item ${i + 1}`, 48 + (i % 10) * 120, 20 + Math.floor(i / 10) * 600, 18));
    for (let i = 0; i < 6; i++)
      layers.push(
        new Line({
          color: "#94a3b8",
          position: { x: 40, y: 600 + i * 12, endX: 1240, endY: 600 + i * 12 },
          stroke: { width: 1 },
        }),
      );
    for (let i = 0; i < 4; i++)
      layers.push(
        new Bezier({
          color: "#38bdf8",
          position: { x: 40, y: 640, endX: 1240, endY: 700 },
          controlPoints: [
            { x: 300 + i * 60, y: 560 },
            { x: 800, y: 740 - i * 20 },
          ],
          stroke: { width: 2 },
        }),
      );
    for (let i = 0; i < 6; i++)
      layers.push(
        new Polygon({
          color: pick(),
          size: { width: 50, height: 50, count: 5 + i, radius: 0 },
          position: { x: 1150, y: 40 + i * 60 },
          centring: "none",
        }),
      );
    scene.load(new Group({}).add(...layers));
    return { scene, animations, layers: layers.length, signals };
  }

  if (name === "complex") {
    const scene = new Scene(1920, 1080, sceneOpts);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    const layers = [morph({ color: "#050914", w: 1920, h: 1080, x: 0, y: 0 })];
    let signals = 0;
    let total = 1;
    // 600 animated particles: position and opacity driven by signals.
    for (let i = 0; i < 600; i++) {
      const baseX = r() * 1800;
      const baseY = r() * 980;
      const x = createSignal(baseX);
      const y = createSignal(baseY);
      const op = createSignal(0.3);
      signals += 3;
      const size = 18 + r() * 30;
      layers.push(
        new Morph({
          color: pick(),
          size: { width: size, height: size, radius: { all: size / 3 } },
          position: { x, y },
          centring: "none",
          opacity: op,
        }),
      );
      const d = 1 + r() * 2;
      animations.push(() =>
        loop(() =>
          all(
            chain(
              x.to(baseX + 80, d, { easing: Easing.easeInOutCubic }),
              x.to(baseX, d, { easing: Easing.easeInOutCubic }),
            ),
            chain(
              y.to(baseY - 60, d * 1.3, { easing: Easing.easeOutQuad ?? Easing.easeOut }),
              y.to(baseY, d * 1.3),
            ),
            chain(waitFor(r() * 0.5), op.to(1, d), op.to(0.3, d)),
          ),
        ),
      );
    }
    total += 600;
    // 10 groups of 20 static layers, nested.
    for (let g = 0; g < 10; g++) {
      const group = new Group({});
      for (let i = 0; i < 20; i++)
        group.add(
          morph({
            color: pick(),
            w: 60,
            h: 40,
            x: 100 + g * 170 + (i % 5) * 20,
            y: 120 + Math.floor(i / 5) * 30,
            r: 8,
          }),
        );
      layers.push(group);
      total += 21;
    }
    for (let i = 0; i < 150; i++)
      layers.push(text(`Label ${i}`, (i % 15) * 125 + 10, 40 + Math.floor(i / 15) * 100, 16));
    total += 150;
    for (let i = 0; i < 100; i++)
      layers.push(
        new Polygon({
          color: pick(),
          size: { width: 40, height: 40, count: 3 + (i % 6), radius: 0 },
          position: { x: (i % 20) * 90 + 20, y: 700 + Math.floor(i / 20) * 60 },
          centring: "none",
          filter: i < 20 ? "blur(3px)" : undefined,
          shadow:
            i >= 20 && i < 50
              ? { color: "#000000aa", blur: 10, offsetX: 0, offsetY: 4 }
              : undefined,
          transform: process.env.BENCH_NOROT ? undefined : { rotate: i * 7 },
        }),
      );
    total += 100;
    for (let i = 0; i < 40; i++) {
      layers.push(
        new Line({
          color: "#64748b",
          position: { x: 0, y: 1000 + (i % 20) * 3, endX: 1920, endY: 1000 + ((i * 7) % 20) * 3 },
          stroke: { width: 1 },
        }),
      );
      layers.push(
        new Bezier({
          color: "#38bdf8",
          position: { x: 0, y: 900, endX: 1920, endY: 1000 },
          controlPoints: [
            { x: 500 + i * 10, y: 800 },
            { x: 1400, y: 1050 - i * 3 },
          ],
          stroke: { width: 1 },
        }),
      );
    }
    total += 80;
    scene.load(new Group({}).add(...layers));
    return { scene, animations, layers: total, signals };
  }

  if (name === "layout-mixed") {
    // A flex layout with text in it that does not change, and animated layers placed by hand on top of it.
    const scene = new Scene(1280, 720, sceneOpts);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    const grid = new Group({
      layout: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        padding: 16,
        width: 1280,
        height: 720,
      },
    });
    for (let i = 0; i < 100; i++) {
      grid.add(new Morph({ color: pick(), layout: { width: 90, height: 40 } }));
      grid.add(new Text({ text: `Item ${i}`, color: "#e2e8f0", font: font(18) }));
    }
    const dots = [];
    let signals = 0;
    for (let i = 0; i < 100; i++) {
      const x = createSignal(r() * 1200);
      const y = createSignal(r() * 680);
      signals += 2;
      dots.push(
        new Morph({
          color: pick(),
          size: { width: 14, height: 14, radius: { all: 7 } },
          position: { x, y },
          centring: "none",
        }),
      );
      animations.push(() =>
        loop(() =>
          all(
            chain(x.to(r() * 1200, 1.5), x.to(r() * 1200, 1.5)),
            chain(y.to(r() * 680, 1.2), y.to(r() * 680, 1.2)),
          ),
        ),
      );
    }
    scene.load(new Group({}).add(grid, ...dots));
    return { scene, animations, layers: 300, signals };
  }

  if (name === "layout") {
    const scene = new Scene(1280, 720, sceneOpts);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    const grid = new Group({
      layout: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        padding: 16,
        width: 1280,
        height: 720,
      },
    });
    for (let i = 0; i < 300; i++)
      grid.add(new Morph({ color: pick(), layout: { width: 56, height: 40 } }));
    scene.load(grid);
    return { scene, animations, layers: 300, signals: 0 };
  }
  throw new Error(`unknown scenario ${name}`);
}

const stats = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    mean,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
};

async function renderScenario(name) {
  const frames = {
    simple: 300,
    medium: 120,
    "medium-cache": 120,
    complex: 30,
    layout: 120,
    "layout-mixed": 120,
  }[name];
  const t0 = now();
  const built = build(name);
  const buildMs = now() - t0;
  const { scene, animations } = built;
  const t1 = now();
  if (!process.env.BENCH_NOANIM) for (const a of animations) scene.addAnimation(a);
  const registerMs = now() - t1;

  const t2 = now();
  await scene.renderFrame(0);
  const firstFrameMs = now() - t2;
  for (let i = 1; i <= 10; i++) await scene.renderFrame(i / 60); // warm-up

  const times = [];
  const callsBefore = adapter.calls?.total ?? 0;
  for (let i = 0; i < frames; i++) {
    const t = now();
    await scene.renderFrame((11 + i) / 60);
    times.push(now() - t);
  }
  const s = stats(times);
  const canvasCallsPerFrame = adapter.calls
    ? (adapter.calls.total - callsBefore) / frames
    : undefined;
  return {
    canvasCallsPerFrame,
    canvasCalls: adapter.calls
      ? Object.fromEntries(
          Object.entries(adapter.calls.byName)
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => [name, Math.round(n / (frames + 11))]),
        )
      : undefined,
    scenario: name,
    layers: built.layers,
    signals: built.signals,
    animations: animations.length,
    buildMs,
    registerMs,
    firstFrameMs,
    frames,
    ...s,
    fps: 1000 / s.mean,
  };
}

/** The animation engine alone: K looping tweens stepped for 10 simulated seconds at 60 fps, no canvas. */
function engine(count, mode) {
  const scheduler =
    mode === "nohistory"
      ? new ThreadScheduler({ history: false })
      : mode === "step60"
        ? new ThreadScheduler({ step: 1 / 60 })
        : new ThreadScheduler();
  const signals = [];
  for (let i = 0; i < count; i++) {
    const s = createSignal(0);
    signals.push(s);
    scheduler.add(loop(() => chain(s.to(100, 1 + (i % 5) * 0.2), s.to(0, 1 + (i % 5) * 0.2))));
    if (mode === "watched" && scheduler.watch) scheduler.watch(s);
  }
  global.gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  const times = [];
  for (let f = 0; f <= 600; f++) {
    const t = now();
    scheduler.update(f / 60);
    times.push(now() - t);
  }
  global.gc?.();
  const heap1 = process.memoryUsage().heapUsed;
  const s = stats(times.slice(10));
  return {
    scenario: `engine-${count}-${mode}`,
    count,
    ...s,
    heapGrowthMB: (heap1 - heap0) / 1048576,
    perSignalUs: (s.mean * 1000) / count,
  };
}

/** How the history grows: 1000 watched signals, a minute of animation at 60 fps. */
function memory(count, mode) {
  const scheduler =
    mode === "nohistory" ? new ThreadScheduler({ history: false }) : new ThreadScheduler();
  for (let i = 0; i < count; i++) {
    const s = createSignal(0);
    scheduler.add(loop(() => chain(s.to(100, 1 + (i % 5) * 0.2), s.to(0, 1 + (i % 5) * 0.2))));
    if (scheduler.watch) scheduler.watch(s);
  }
  global.gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  const times = [];
  for (let f = 0; f <= 3600; f++) {
    const t = now();
    scheduler.update(f / 60);
    times.push(now() - t);
  }
  global.gc?.();
  const heap1 = process.memoryUsage().heapUsed;
  const s = stats(times);
  return {
    scenario: `memory-${count}-${mode}`,
    count,
    seconds: 60,
    ...s,
    heapGrowthMB: (heap1 - heap0) / 1048576,
  };
}

/** Moving the timeline around (new engine only). `big` raises the history budget so all of it is kept. */
function seek(count, big) {
  const scheduler = new ThreadScheduler(big ? { history: { maxEntries: 40_000_000 } } : {});
  for (let i = 0; i < count; i++) {
    const s = createSignal(0);
    scheduler.add(loop(() => chain(s.to(100, 1 + (i % 5) * 0.2), s.to(0, 1 + (i % 5) * 0.2))));
    scheduler.watch(s);
  }
  const time = (f) => {
    const t = now();
    f();
    return now() - t;
  };
  const play20 = time(() => {
    for (let f = 0; f <= 1200; f++) scheduler.update(f / 60);
  });
  // How far back the history reaches: with the default budget, less than the 20 s played.
  const back = big ? 5 : 19;
  const backMs = time(() => scheduler.update(back));
  const scrub = time(() => {
    for (let f = 0; f < 600; f++) scheduler.update(back + (f % 60) / 60);
  });
  const liveEdge = time(() => scheduler.update(20 + 1 / 60));
  const far = time(() => scheduler.update(80));
  return {
    scenario: `seek-${count}-${big ? "big" : "default"}`,
    count,
    play20sMs: play20,
    backToMs: back,
    backMs,
    scrubPerFrameMs: scrub / 600,
    liveEdgeMs: liveEdge,
    simulate60sMs: far,
  };
}

/** Transforms, on 300 layers with an animated rotation. */
async function xform(mode) {
  const scene = new Scene(1280, 720, { adapter });
  const layers = [];
  const angles = [];
  for (let i = 0; i < 300; i++) {
    const angle = createSignal(0);
    angles.push(angle);
    const transform =
      mode === "none"
        ? undefined
        : mode === "legacy"
          ? { rotate: angle }
          : { rotate: angle, scale: 1.1, origin: "center" };
    layers.push(
      new Morph({
        color: palette[i % 7],
        size: { width: 40, height: 40, radius: { all: 6 } },
        position: { x: (i % 30) * 42, y: Math.floor(i / 30) * 60 },
        centring: "none",
        transform,
      }),
    );
  }
  scene.load(new Group({}).add(...layers));
  for (const angle of angles)
    scene.addAnimation(() => loop(() => chain(angle.to(360, 2), angle.to(0, 0))));
  for (let i = 0; i < 10; i++) await scene.renderFrame(i / 60);
  const times = [];
  for (let i = 0; i < 120; i++) {
    const t = now();
    await scene.renderFrame((10 + i) / 60);
    times.push(now() - t);
  }
  return { scenario: `xform-${mode}`, ...stats(times) };
}

/** Hit testing, positions and the new animation helpers (new engine only). */
async function extras() {
  const { Transform, stagger, createSignal: cs, ThreadScheduler: TS, Matrix } = lib;
  const built = build("complex");
  const { scene } = built;
  await scene.renderFrame(0);
  const t0 = now();
  const N = 200;
  for (let i = 0; i < N; i++) scene.layerAt({ x: (i * 37) % 1900, y: (i * 53) % 1000 });
  const layerAtMs = (now() - t0) / N;

  const t1 = now();
  for (let i = 0; i < 100; i++) {
    const m = Matrix.translation(i, 2).multiply(Matrix.rotation(i)).multiply(Matrix.scaling(2, 1));
    m.inverse().apply({ x: 1, y: 2 });
    m.decompose();
  }
  const matrixUs = ((now() - t1) * 1000) / 100;

  const sigs = Array.from({ length: 1000 }, () => cs(0));
  const t2 = now();
  const ts = new TS();
  ts.add(stagger(0.01, sigs, (s) => s.to(1, 1)));
  ts.update(0);
  ts.update(12);
  const staggerMs = now() - t2;

  const springs = Array.from({ length: 1000 }, () => cs(0));
  const ts2 = new TS();
  for (const s of springs) ts2.add(s.spring(100, "wobbly"));
  const t3 = now();
  ts2.update(0);
  for (let f = 1; f <= 120; f++) ts2.update(f / 60);
  const springFrameMs = (now() - t3) / 120;

  const tr = new Transform({ rotate: 10, scale: 2, origin: "center", skew: { x: 5, y: 0 } });
  const t4 = now();
  for (let i = 0; i < 100000; i++) tr.toMatrix({ x: 0, y: 0, width: 50, height: 50 });
  const toMatrixUs = ((now() - t4) * 1000) / 100000;

  return {
    scenario: "extras",
    layers: built.layers,
    layerAtMs,
    matrixOpsUs: matrixUs,
    staggerOf1000Ms: staggerMs,
    springsOf1000PerFrameMs: springFrameMs,
    transformToMatrixUs: toMatrixUs,
  };
}

const out = await (async () => {
  if (scenario.startsWith("engine-")) {
    const [, n, mode] = scenario.split("-");
    return engine(Number(n), mode ?? "plain");
  }
  if (scenario.startsWith("memory-")) {
    const [, n, mode] = scenario.split("-");
    return memory(Number(n), mode);
  }
  if (scenario.startsWith("seek-"))
    return seek(Number(scenario.split("-")[1]), scenario.split("-")[2] === "big");
  if (scenario.startsWith("xform-")) return xform(scenario.split("-")[1]);
  if (scenario === "extras") return extras();
  return renderScenario(scenario);
})();
console.log(JSON.stringify(out));
clearInterval(keepAlive);

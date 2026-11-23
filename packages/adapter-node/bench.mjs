// Benchmark: run as `node --expose-gc bench.mjs <scenario>` from inside packages/lazycanvas of a build.
import { NodeCanvasAdapter } from "./dist/index.mjs";
import {
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
} from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";

const adapter = new NodeCanvasAdapter();
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
  const sceneOpts = { adapter, ...opts.scene };

  if (name === "simple") {
    const scene = new Scene(800, 450, sceneOpts);
    const x = createSignal(40);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    scene.load(
      new Group({}).add(
        morph({ color: "#0f172a", w: 800, h: 450, x: 0, y: 0 }),
        morph({ color: "#1e293b", w: 720, h: 300, x: 40, y: 70, r: 20, shadow: { color: "#00000088", blur: 20, offsetX: 0, offsetY: 8 } }),
        text("LazyCanvas", 70, 110, 44, "#ffffff"),
        text("declarative canvas rendering", 70, 170, 22),
        new Morph({ color: "#3b82f6", size: { width: 48, height: 48, radius: { all: 12 } }, position: { x, y: 260 }, centring: "none" }),
      ),
    );
    animations.push(() => loop(() => chain(x.to(700, 1.5, { easing: Easing.easeInOutCubic }), x.to(40, 1.5, { easing: Easing.easeInOutCubic }))));
    return { scene, animations, layers: 5, signals: 1 };
  }

  if (name === "medium" || name === "medium-cache") {
    const scene = new Scene(1280, 720, { ...sceneOpts, cache: name === "medium-cache" ? true : undefined });
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
                chain(x.to(baseX + 16, 0.8 + (index % 5) * 0.1, { easing: Easing.easeInOutSine }), x.to(baseX, 0.8 + (index % 5) * 0.1, { easing: Easing.easeInOutSine })),
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
              shadow: index % 9 === 1 ? { color: "#00000099", blur: 12, offsetX: 0, offsetY: 4 } : undefined,
            }),
          );
        }
      }
    }
    for (let i = 0; i < 20; i++) layers.push(text(`Item ${i + 1}`, 48 + (i % 10) * 120, 20 + Math.floor(i / 10) * 600, 18));
    for (let i = 0; i < 6; i++)
      layers.push(new Line({ color: "#94a3b8", position: { x: 40, y: 600 + i * 12, endX: 1240, endY: 600 + i * 12 }, stroke: { width: 1 } }));
    for (let i = 0; i < 4; i++)
      layers.push(new Bezier({ color: "#38bdf8", position: { x: 40, y: 640, endX: 1240, endY: 700 }, controlPoints: [{ x: 300 + i * 60, y: 560 }, { x: 800, y: 740 - i * 20 }], stroke: { width: 2 } }));
    for (let i = 0; i < 6; i++)
      layers.push(new Polygon({ color: pick(), size: { width: 50, height: 50, count: 5 + i, radius: 0 }, position: { x: 1150, y: 40 + i * 60 }, centring: "none" }));
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
        new Morph({ color: pick(), size: { width: size, height: size, radius: { all: size / 3 } }, position: { x, y }, centring: "none", opacity: op }),
      );
      const d = 1 + r() * 2;
      animations.push(() =>
        loop(() =>
          all(
            chain(x.to(baseX + 80, d, { easing: Easing.easeInOutCubic }), x.to(baseX, d, { easing: Easing.easeInOutCubic })),
            chain(y.to(baseY - 60, d * 1.3, { easing: Easing.easeOutQuad ?? Easing.easeOut }), y.to(baseY, d * 1.3)),
            chain(waitFor(r() * 0.5), op.to(1, d), op.to(0.3, d)),
          ),
        ),
      );
    }
    total += 600;
    // 10 groups of 20 static layers, nested.
    for (let g = 0; g < 10; g++) {
      const group = new Group({});
      for (let i = 0; i < 20; i++) group.add(morph({ color: pick(), w: 60, h: 40, x: 100 + g * 170 + (i % 5) * 20, y: 120 + Math.floor(i / 5) * 30, r: 8 }));
      layers.push(group);
      total += 21;
    }
    for (let i = 0; i < 150; i++) layers.push(text(`Label ${i}`, (i % 15) * 125 + 10, 40 + Math.floor(i / 15) * 100, 16));
    total += 150;
    for (let i = 0; i < 100; i++)
      layers.push(
        new Polygon({
          color: pick(),
          size: { width: 40, height: 40, count: 3 + (i % 6), radius: 0 },
          position: { x: (i % 20) * 90 + 20, y: 700 + Math.floor(i / 20) * 60 },
          centring: "none",
          filter: i < 20 ? "blur(3px)" : undefined,
          shadow: i >= 20 && i < 50 ? { color: "#000000aa", blur: 10, offsetX: 0, offsetY: 4 } : undefined,
          transform: { rotate: i * 7 },
        }),
      );
    total += 100;
    for (let i = 0; i < 40; i++) {
      layers.push(new Line({ color: "#64748b", position: { x: 0, y: 1000 + (i % 20) * 3, endX: 1920, endY: 1000 + ((i * 7) % 20) * 3 }, stroke: { width: 1 } }));
      layers.push(new Bezier({ color: "#38bdf8", position: { x: 0, y: 900, endX: 1920, endY: 1000 }, controlPoints: [{ x: 500 + i * 10, y: 800 }, { x: 1400, y: 1050 - i * 3 }], stroke: { width: 1 } }));
    }
    total += 80;
    scene.load(new Group({}).add(...layers));
    return { scene, animations, layers: total, signals };
  }

  if (name === "layout") {
    const scene = new Scene(1280, 720, sceneOpts);
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    const grid = new Group({ layout: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, width: 1280, height: 720 } });
    for (let i = 0; i < 300; i++) grid.add(new Morph({ color: pick(), layout: { width: 56, height: 40 } }));
    scene.load(grid);
    return { scene, animations, layers: 300, signals: 0 };
  }
  throw new Error(`unknown scenario ${name}`);
}

const stats = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { mean, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], min: sorted[0], max: sorted[sorted.length - 1] };
};

async function renderScenario(name) {
  const frames = { simple: 300, medium: 120, "medium-cache": 120, complex: 30, layout: 120 }[name];
  const t0 = now();
  const built = build(name);
  const buildMs = now() - t0;
  const { scene, animations } = built;
  const t1 = now();
  for (const a of animations) scene.addAnimation(a);
  const registerMs = now() - t1;

  const t2 = now();
  await scene.renderFrame(0);
  const firstFrameMs = now() - t2;
  for (let i = 1; i <= 10; i++) await scene.renderFrame(i / 60); // warm-up

  const times = [];
  for (let i = 0; i < frames; i++) {
    const t = now();
    await scene.renderFrame((11 + i) / 60);
    times.push(now() - t);
  }
  const s = stats(times);
  return { scenario: name, layers: built.layers, signals: built.signals, animations: animations.length, buildMs, registerMs, firstFrameMs, frames, ...s, fps: 1000 / s.mean };
}

/** The animation engine alone: no canvas, K looping tweens stepped for 10 simulated seconds at 60 fps. */
function engine(count, withWatch) {
  const scheduler = new ThreadScheduler();
  const signals = [];
  for (let i = 0; i < count; i++) {
    const s = createSignal(0);
    signals.push(s);
    scheduler.add(loop(() => chain(s.to(100, 1 + (i % 5) * 0.2), s.to(0, 1 + (i % 5) * 0.2))));
    if (withWatch && scheduler.watch) scheduler.watch(s);
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
  return { scenario: `engine-${count}${withWatch ? "-watched" : ""}`, count, ...s, heapGrowthMB: (heap1 - heap0) / 1048576, perSignalUs: (s.mean * 1000) / count };
}

const out =
  scenario.startsWith("engine-")
    ? (() => {
        const [, n, w] = scenario.split("-");
        return engine(Number(n), w === "watched");
      })()
    : await renderScenario(scenario);
console.log(JSON.stringify(out));

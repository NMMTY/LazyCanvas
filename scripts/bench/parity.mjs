// Pixel parity between two builds of the library: renders a set of scenes that between them use every layer
// type and prints a hash of each frame. Run it against two checkouts and compare:
//
//   LAZYCANVAS_ROOT=/path/to/old node scripts/bench/parity.mjs > old.json
//   node scripts/bench/parity.mjs > new.json
//
// or let it do both: `node scripts/bench/parity.mjs --against <checkout>` exits 1 if any frame differs.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const against = process.argv.includes("--against")
  ? resolve(process.argv[process.argv.indexOf("--against") + 1])
  : null;

if (against) {
  const run = (root) => {
    const out = spawnSync("node", [fileURLToPath(import.meta.url)], {
      env: { ...process.env, LAZYCANVAS_ROOT: root },
      encoding: "utf8",
      maxBuffer: 1 << 28,
    });
    if (out.status !== 0) throw new Error(out.stderr || `parity run failed in ${root}`);
    return JSON.parse(out.stdout.trim().split("\n").pop());
  };
  const before = run(against);
  const after = run(resolve(here, "..", ".."));
  let bad = 0;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) {
      bad++;
      console.log(`DIFFERENT  ${key}\n    before ${before[key]}\n    after  ${after[key]}`);
    }
  }
  console.log(`${Object.keys(after).length} frames compared, ${bad} different`);
  process.exit(bad ? 1 : 0);
}

const root = resolve(process.env.LAZYCANVAS_ROOT ?? join(here, "..", ".."));
const load = (path) => {
  const file = join(root, path);
  if (!existsSync(file)) throw new Error(`${file} is missing: build that checkout first`);
  return import(pathToFileURL(file).href);
};
const { NodeCanvasAdapter } = await load("packages/adapter-node/dist/index.mjs");
const lib = await load("packages/lazycanvas/dist/index.mjs");
const { Fonts } = await load("packages/lazycanvas/dist/fonts/index.mjs");
const {
  Bezier,
  Easing,
  Group,
  Gradient,
  Image,
  Line,
  Morph,
  Path2D,
  Pattern,
  Polygon,
  Quadratic,
  Scene,
  Text,
  chain,
  createSignal,
} = lib;

const adapter = new NodeCanvasAdapter();
const hashes = {};

// A small picture, made here so that nothing depends on a file or the network.
const tile = adapter.createCanvas(16, 16);
{
  const c = tile.getContext("2d");
  c.fillStyle = "#f43f5e";
  c.fillRect(0, 0, 16, 16);
  c.fillStyle = "#1e293b";
  c.fillRect(0, 0, 8, 8);
  c.fillRect(8, 8, 8, 8);
}
const tileBuffer = tile.toBuffer("image/png");
const tileUrl = `data:image/png;base64,${tileBuffer.toString("base64")}`;

const font = (size, weight = 600) => ({ family: "Geist", size, weight });
const checks = [];

function scene(name, w, h, build, times = [0]) {
  checks.push({ name, w, h, build, times });
}

scene("morph-variants", 400, 300, (s) => [
  new Morph({
    color: "#0f172a",
    size: { width: "100%", height: "100%" },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  new Morph({
    color: "#3b82f6",
    size: { width: 100, height: 60, radius: { all: 14 } },
    position: { x: 20, y: 20 },
    centring: "none",
  }),
  new Morph({
    color: "#22c55e",
    size: {
      width: "20%",
      height: "10%",
      radius: { topLeft: 4, topRight: 20, bottomRight: 8, bottomLeft: 0 },
    },
    position: { x: 150, y: 20 },
    centring: "none",
    opacity: 0.6,
  }),
  new Morph({
    color: "#f59e0b",
    size: { width: 90, height: 60, radius: { all: 10 } },
    position: { x: 260, y: 20 },
    centring: "none",
    stroke: { width: 4, cap: "round", join: "round", dash: [8, 4] },
  }),
  new Morph({
    color: "#a855f7",
    size: { width: 90, height: 60, radius: { all: 10 } },
    position: { x: 20, y: 120 },
    centring: "none",
    shadow: { color: "#000000aa", blur: 12, offsetX: 4, offsetY: 6 },
  }),
  new Morph({
    color: "#ec4899",
    size: { width: 90, height: 60 },
    position: { x: 150, y: 120 },
    centring: "none",
    filter: [{ type: "blur", value: 2 }],
  }),
  new Morph({
    color: "#14b8a6",
    size: { width: 90, height: 60, radius: { all: 30 } },
    position: { x: 260, y: 120 },
    centring: "none",
    transform: { rotate: 25, scale: 1.2 },
  }),
  new Morph({
    color: "#ef4444",
    size: { width: 80, height: 50 },
    position: { x: 40, y: 220 },
    centring: "center",
    transform: { skew: { x: 15, y: 0 } },
  }),
  new Morph({
    color: "#e2e8f0",
    size: { width: 80, height: 50 },
    position: { x: 200, y: 240 },
    centring: "center",
    globalComposite: "difference",
  }),
]);

scene("fills", 400, 200, () => [
  new Morph({
    color: "#111827",
    size: { width: 400, height: 200 },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  new Morph({
    color: new Gradient()
      .setType("linear")
      .setPoints({ x: 10, y: 10 }, { x: 140, y: 140 })
      .setStops({ color: "#f43f5e", offset: 0 }, { color: "#6366f1", offset: 1 }),
    size: { width: 130, height: 130, radius: { all: 16 } },
    position: { x: 10, y: 10 },
    centring: "none",
  }),
  new Morph({
    color: new Pattern().setSrc(tileUrl).setType("repeat"),
    size: { width: 130, height: 130 },
    position: { x: 160, y: 10 },
    centring: "none",
  }),
  new Text({
    text: "Gradient",
    color: new Gradient()
      .setType("linear")
      .setPoints({ x: 300, y: 10 }, { x: 390, y: 10 })
      .setStops({ color: "#22c55e", offset: 0 }, { color: "#3b82f6", offset: 1 }),
    font: font(28),
    position: { x: 300, y: 40 },
    centring: "none",
    align: "left",
  }),
]);

scene("lines-and-curves", 400, 300, () => [
  new Morph({
    color: "#0b1220",
    size: { width: 400, height: 300 },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  new Line({
    position: { x: 20, y: 20, endX: 180, endY: 60 },
    color: "#38bdf8",
    stroke: { width: 4, cap: "round" },
  }),
  new Bezier({
    position: { x: 20, y: 120, endX: 180, endY: 120 },
    controlPoints: [
      { x: 60, y: 60 },
      { x: 140, y: 180 },
    ],
    color: "#f59e0b",
    stroke: { width: 3 },
  }),
  new Quadratic({
    position: { x: 220, y: 120, endX: 380, endY: 120 },
    controlPoints: [{ x: 300, y: 40 }],
    color: "#a3e635",
    stroke: { width: 3 },
  }),
  new Polygon({
    points: [
      { x: 220, y: 200 },
      { x: 280, y: 190 },
      { x: 300, y: 260 },
      { x: 240, y: 280 },
    ],
    color: "#ec4899",
    transform: { rotate: 10 },
  }),
  new Path2D({ path2D: "M20 200 L90 200 L55 270 Z", color: "#22c55e" }),
  new Path2D({
    path2D: "M110 200 L180 200 L145 270 Z",
    color: "#ef4444",
    stroke: { width: 3, join: "round" },
  }),
]);

scene("text", 520, 360, () => [
  new Morph({
    color: "#0f172a",
    size: { width: 520, height: 360 },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  new Text({
    text: "Single line",
    color: "#ffffff",
    font: font(30),
    position: { x: 20, y: 20 },
    centring: "none",
    align: "left",
  }),
  new Text({
    text: "Coloured substrings",
    color: "#e2e8f0",
    font: font(26),
    position: { x: 20, y: 70 },
    centring: "none",
    align: "left",
    subStringColors: [
      { color: "#f43f5e", start: 0, end: 6 },
      { color: "#22c55e", start: 10, end: 14 },
    ],
  }),
  new Text({
    text: "A longer text that has to wrap onto several lines to show the multiline mode",
    color: "#cbd5e1",
    font: font(18, 400),
    size: { width: 220, height: 120 },
    multiline: { enabled: true, spacing: 4 },
    position: { x: 20, y: 120 },
    centring: "none",
    align: "left",
  }),
  new Text({
    text: "Vertical",
    color: "#fbbf24",
    font: font(22),
    vertical: { mode: "upright", columns: "ltr", gap: 4 },
    position: { x: 300, y: 20 },
    centring: "none",
    align: "left",
  }),
  new Text({
    text: "Centred",
    color: "#a5b4fc",
    font: font(28),
    position: { x: 400, y: 300 },
    centring: "center",
    align: "center",
  }),
  new Text({
    text: "Rotated",
    color: "#34d399",
    font: font(28),
    position: { x: 100, y: 300 },
    centring: "center",
    align: "center",
    transform: { rotate: -15 },
  }),
  new Text({
    text: "Outlined",
    color: "#ffffff",
    font: font(32),
    stroke: { width: 2 },
    position: { x: 300, y: 120 },
    centring: "none",
    align: "left",
  }),
  new Text({
    text: "Shadow",
    color: "#ffffff",
    font: font(30),
    shadow: { color: "#000000", blur: 6, offsetX: 3, offsetY: 3 },
    position: { x: 300, y: 180 },
    centring: "none",
    align: "left",
  }),
]);

scene("groups", 400, 300, () => [
  new Morph({
    color: "#111827",
    size: { width: 400, height: 300 },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  new Group({ position: { x: 40, y: 40 }, transform: { rotate: 8 }, opacity: 1 }).add(
    new Morph({
      color: "#3b82f6",
      size: { width: 120, height: 80, radius: { all: 12 } },
      position: { x: 0, y: 0 },
      centring: "none",
      shadow: { color: "#000000aa", blur: 10, offsetX: 0, offsetY: 6 },
    }),
    new Group({ position: { x: 30, y: 20 }, transform: { scale: 1.3 } }).add(
      new Morph({
        color: "#f43f5e",
        size: { width: 40, height: 40, radius: { all: 20 } },
        position: { x: 0, y: 0 },
        centring: "none",
        globalComposite: "screen",
      }),
      new Text({
        text: "Hi",
        color: "#fff",
        font: font(20),
        position: { x: 8, y: 8 },
        centring: "none",
        align: "left",
      }),
    ),
    new Morph({
      color: "#22c55e",
      size: { width: 30, height: 30 },
      position: { x: 100, y: 60 },
      centring: "none",
    }),
  ),
  new Group({
    layout: { flexDirection: "row", gap: 8, padding: 8, width: 300, height: 90 },
    position: { x: 40, y: 190 },
  }).add(
    new Morph({ color: "#a855f7", size: { width: 60, height: 40 }, centring: "none" }),
    new Text({ text: "flex", color: "#fff", font: font(22), centring: "none", align: "left" }),
    new Morph({
      color: "#f59e0b",
      size: { width: 80, height: 60, radius: { all: 8 } },
      centring: "none",
    }),
  ),
]);

scene("images-between-sync-layers", 300, 200, () => [
  new Morph({
    color: "#0f172a",
    size: { width: 300, height: 200 },
    position: { x: 0, y: 0 },
    centring: "none",
  }),
  // An image (it has to wait) between layers that do not: the order they are painted in must not change.
  new Morph({
    color: "#ef4444",
    size: { width: 120, height: 120 },
    position: { x: 20, y: 20 },
    centring: "none",
  }),
  new Image({
    src: tileBuffer,
    size: { width: 120, height: 120 },
    position: { x: 60, y: 60 },
    centring: "none",
  }),
  new Morph({
    color: "#22c55e88",
    size: { width: 120, height: 60 },
    position: { x: 100, y: 100 },
    centring: "none",
  }),
  new Group({ position: { x: 160, y: 20 } }).add(
    new Image({
      src: tileBuffer,
      size: { width: 80, height: 80 },
      position: { x: 0, y: 0 },
      centring: "none",
    }),
    new Morph({
      color: "#3b82f6aa",
      size: { width: 50, height: 50 },
      position: { x: 30, y: 30 },
      centring: "none",
    }),
  ),
]);

scene(
  "signals",
  400,
  200,
  (s) => {
    const x = createSignal(20);
    const w = createSignal(40);
    const color = createSignal("#ef4444");
    s.__anim = () => chain(x.to(300, 2, { easing: Easing.easeInOutCubic }), x.to(20, 2));
    s.__anim2 = () => w.to(120, 2);
    s.__anim3 = () => color.to("#3b82f6", 2);
    return [
      new Morph({
        color: "#0f172a",
        size: { width: 400, height: 200 },
        position: { x: 0, y: 0 },
        centring: "none",
      }),
      new Morph({
        color,
        size: { width: w, height: 60, radius: { all: 10 } },
        position: { x, y: 40 },
        centring: "none",
        transform: { rotate: 12 },
      }),
      new Text({
        text: "signals",
        color: "#fff",
        font: font(26),
        position: { x, y: 130 },
        centring: "none",
        align: "left",
      }),
    ];
  },
  [0, 0.4, 1, 1.7, 2.5, 3.9],
);

scene("failing-layer-and-siblings", 200, 100, () => {
  const bad = new Morph({
    color: "#ef4444",
    size: { width: 40, height: 40 },
    position: { x: 10, y: 10 },
    centring: "none",
  });
  bad.draw = () => {
    throw new Error("boom");
  };
  return [
    new Morph({
      color: "#0f172a",
      size: { width: 200, height: 100 },
      position: { x: 0, y: 0 },
      centring: "none",
    }),
    bad,
    new Morph({
      color: "#22c55e",
      size: { width: 40, height: 40 },
      position: { x: 100, y: 10 },
      centring: "none",
    }),
  ];
});

for (const check of checks) {
  const sc = new Scene(check.w, check.h, { adapter });
  sc.lazyCanvas.manager.fonts.loadFonts(Fonts);
  const holder = {};
  const layers = check.build(holder);
  sc.load(new Group({}).add(...layers));
  for (const key of ["__anim", "__anim2", "__anim3"]) {
    if (holder[key]) sc.addAnimation(holder[key]);
  }
  for (const t of check.times) {
    let outcome = "ok";
    try {
      await sc.renderFrame(t);
    } catch (error) {
      outcome = `error:${error.message}`;
    }
    const data = sc.getImageData();
    hashes[`${check.name}@${t}`] = `${outcome}|${createHash("sha1").update(data).digest("hex")}`;
  }
}
console.log(JSON.stringify(hashes));
process.exit(0);

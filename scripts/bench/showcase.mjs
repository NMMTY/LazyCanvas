#!/usr/bin/env node
// Renders the showcase scenes (scripts/bench/showcase/*.mjs) to video and prints how long that took.
//
//   pnpm build && node --expose-gc scripts/bench/showcase.mjs     both scenes, 1280 px wide, 60 fps
//   node scripts/bench/showcase.mjs memory --width 960 --fps 30   one scene, other size and rate
//   node scripts/bench/showcase.mjs --no-video                    only the numbers
//   node scripts/bench/showcase.mjs --out some/dir --history false
//
// For each scene it writes <out>/<scene>.mp4 (needs ffmpeg), <out>/<scene>-sheet.png (twelve frames)
// and <out>/<scene>-frames.png (the time every frame took), and <out>/stats.json. Then it moves
// the timeline to random frames in random order and checks that they come out identical to the ones that
// were rendered in a row.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.LAZYCANVAS_ROOT ?? join(here, "..", ".."));
const load = (path) => import(pathToFileURL(join(root, path)).href);

const { NodeCanvasAdapter } = await load("packages/adapter-node/dist/index.mjs");
const lib = await load("packages/lazycanvas/dist/index.mjs");
const { Fonts } = await load("packages/lazycanvas/dist/fonts/index.mjs");

const SCENES = ["memory", "state-machine"];
const args = {
  scenes: [],
  width: 1280,
  fps: 60,
  out: join(root, "bench-out"),
  video: true,
  history: true,
};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const [key, inline] = argv[i].split("=");
  const value = () => inline ?? argv[++i];
  if (key === "--width") args.width = Number(value());
  else if (key === "--fps") args.fps = Number(value());
  else if (key === "--out") args.out = resolve(value());
  else if (key === "--no-video") args.video = false;
  else if (key === "--history") args.history = value() !== "false";
  else if (SCENES.includes(key)) args.scenes.push(key);
  else if (key === "all") args.scenes.push(...SCENES);
  else throw new Error(`Unknown argument ${argv[i]}. Scenes: ${SCENES.join(", ")}`);
}
if (args.scenes.length === 0) args.scenes = SCENES;
mkdirSync(args.out, { recursive: true });

const now = () => Number(process.hrtime.bigint()) / 1e6;
const adapter = new NodeCanvasAdapter();

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    mean,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function startFfmpeg(file, width, height, fps) {
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-r",
      String(fps),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolveDone, reject) => {
    ffmpeg.on("exit", (code) =>
      code === 0 ? resolveDone() : reject(new Error(`ffmpeg exited with ${code}`)),
    );
    ffmpeg.on("error", reject);
  });
  return {
    async write(buffer) {
      if (!ffmpeg.stdin.write(buffer)) await once(ffmpeg.stdin, "drain");
    },
    async end() {
      ffmpeg.stdin.end();
      await done;
    },
  };
}

/** A grid of frames of the scene, filled in while the scene plays. */
function createSheet(built, count, file) {
  const { width, height } = built;
  const cols = 4;
  const rows = Math.ceil(count / cols);
  const cell = Math.round(width / 2);
  const cellH = Math.round((height / width) * cell);
  const sheet = adapter.createCanvas(cols * cell, rows * cellH);
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  return {
    add(index, seconds) {
      const x = (index % cols) * cell;
      const y = Math.floor(index / cols) * cellH;
      ctx.drawImage(built.scene.lazyCanvas.canvas, x, y, cell, cellH);
      ctx.fillStyle = "#ffffffcc";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${seconds.toFixed(1)} s`, x + 8, y + 20);
    },
    save: () => writeFileSync(file, sheet.toBuffer("image/png")),
  };
}

/** How long each frame took, over the length of the scene. */
function chart(times, duration, summary, file) {
  const w = 1200;
  const h = 360;
  const canvas = adapter.createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#101418";
  ctx.fillRect(0, 0, w, h);
  const top = Math.max(summary.p99 * 1.4, 4);
  const plot = { x: 60, y: 30, w: w - 90, h: h - 80 };
  const X = (i) => plot.x + (i / (times.length - 1)) * plot.w;
  const Y = (ms) => plot.y + plot.h - (Math.min(ms, top) / top) * plot.h;

  ctx.font = "13px sans-serif";
  ctx.strokeStyle = "#2a323a";
  ctx.fillStyle = "#8b98a5";
  for (let g = 0; g <= 4; g++) {
    const ms = (top / 4) * g;
    ctx.beginPath();
    ctx.moveTo(plot.x, Y(ms));
    ctx.lineTo(plot.x + plot.w, Y(ms));
    ctx.stroke();
    ctx.fillText(`${ms.toFixed(1)}`, 14, Y(ms) + 4);
  }
  ctx.fillText("ms", 14, 20);
  for (let s = 0; s <= duration; s += Math.max(1, Math.round(duration / 10))) {
    ctx.fillText(`${s}s`, plot.x + (s / duration) * plot.w - 8, plot.y + plot.h + 22);
  }

  ctx.strokeStyle = "#4aa3ff55";
  ctx.beginPath();
  times.forEach((ms, i) => (i === 0 ? ctx.moveTo(X(i), Y(ms)) : ctx.lineTo(X(i), Y(ms))));
  ctx.stroke();

  // moving average over a quarter of a second
  const win = Math.max(2, Math.round(times.length / duration / 4));
  ctx.strokeStyle = "#ffb454";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < times.length; i++) {
    const from = Math.max(0, i - win);
    const avg = times.slice(from, i + 1).reduce((a, b) => a + b, 0) / (i + 1 - from);
    i === 0 ? ctx.moveTo(X(i), Y(avg)) : ctx.lineTo(X(i), Y(avg));
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  for (const [value, color, label] of [
    [summary.p50, "#7ee787", "p50"],
    [summary.p95, "#ff7b72", "p95"],
  ]) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(plot.x, Y(value));
    ctx.lineTo(plot.x + plot.w, Y(value));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(`${label} ${value.toFixed(2)} ms`, plot.x + plot.w - 110, Y(value) - 6);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#e6edf3";
  ctx.font = "15px sans-serif";
  ctx.fillText("time to render each frame (blue), average over 0.25 s (orange)", plot.x, 20);
  writeFileSync(file, canvas.toBuffer("image/png"));
}

const hash = (data) => createHash("md5").update(data).digest("hex");
const report = [];

for (const name of args.scenes) {
  const mod = await load(`scripts/bench/showcase/${name}.mjs`);
  const sceneOptions = args.history ? {} : { history: false };
  const built = mod.build(lib, adapter, { width: args.width, fonts: Fonts, sceneOptions });
  const { scene, width, height } = built;
  const frames = Math.floor(built.duration * args.fps) + 1;
  console.error(
    `${name}: ${width}×${height}, ${built.duration.toFixed(1)} s, ${frames} frames at ${args.fps} fps, ${built.layers} layers`,
  );

  const sheetFrames = Array.from({ length: 12 }, (_, i) =>
    Math.min(frames - 1, Math.round(((i + 0.5) / 12) * (frames - 1))),
  );
  const sheet = createSheet(built, sheetFrames.length, join(args.out, `${name}-sheet.png`));
  const video = args.video
    ? startFfmpeg(join(args.out, `${name}.mp4`), width, height, args.fps)
    : null;
  const renderMs = [];
  const readMs = [];
  const hashes = new Map();
  let firstFrameMs = 0;
  let peakRss = 0;
  global.gc?.();
  const rssAfterBuild = process.memoryUsage().rss;
  const wall = now();

  for (let i = 0; i < frames; i++) {
    const t = i / args.fps;
    const start = now();
    await scene.renderFrame(t);
    const rendered = now();
    const data = scene.getImageData();
    const read = now();
    if (i === 0) firstFrameMs = rendered - start;
    renderMs.push(rendered - start);
    readMs.push(read - rendered);
    if (i % 30 === 0) hashes.set(i, hash(data));
    const slot = sheetFrames.indexOf(i);
    if (slot !== -1) sheet.add(slot, t);
    if (video) await video.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    // A loop made only of promises never lets the event loop run, and the native memory behind every
    // read-back is only released from there: without this the process fills up with pixels.
    await new Promise((done) => setImmediate(done));
    if (i % 120 === 0) {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      // Every read-back is a buffer the size of a frame; without allocations on the JS heap V8 is slow to
      // collect them, which would show up as memory use that belongs to this script and not to the library.
      global.gc?.();
    }
  }
  if (video) await video.end();
  const wallMs = now() - wall;
  global.gc?.();
  const liveHeapMB = process.memoryUsage().heapUsed / 1048576;

  sheet.save();

  // Move around in time: random frames, in random order, must look exactly like they did the first time.
  // Without a history there is nothing to go back to.
  const probe = args.history ? [...hashes.keys()] : [];
  let seed = 12345;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const order = probe
    .map((i) => [rand(), i])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  let identical = 0;
  let unreachable = 0;
  const scrub = [];
  for (const i of order) {
    const start = now();
    try {
      await scene.renderFrame(i / args.fps);
      scrub.push(now() - start);
      if (hash(scene.getImageData()) === hashes.get(i)) identical++;
      await new Promise((done) => setImmediate(done));
    } catch {
      unreachable++; // older than the history that was kept
    }
  }

  const summary = stats(renderMs);
  chart(renderMs, built.duration, summary, join(args.out, `${name}-frames.png`));

  const result = {
    scene: name,
    width,
    height,
    fps: args.fps,
    seconds: built.duration,
    frames,
    layers: built.layers,
    signals: built.signals,
    history: args.history,
    renderMs: summary,
    firstFrameMs,
    readbackMs: stats(readMs),
    totalRenderSeconds: renderMs.reduce((a, b) => a + b, 0) / 1000,
    wallSeconds: wallMs / 1000,
    fasterThanRealtime: (built.duration * 1000) / renderMs.reduce((a, b) => a + b, 0),
    peakRssMB: peakRss / 1048576,
    rssAfterBuildMB: rssAfterBuild / 1048576,
    liveHeapMB,
    scrub: {
      probed: order.length,
      identical,
      unreachable,
      msPerFrame: scrub.length ? stats(scrub).mean : null,
    },
  };
  report.push(result);
  writeFileSync(join(args.out, "stats.json"), `${JSON.stringify(report, null, 2)}\n`);
}

const f = (n, d = 2) => n.toFixed(d);
console.log(
  `\nShowcase render, Node ${process.version}, ${args.width}px wide, ${args.fps} fps, history ${args.history ? "on" : "off"}\n`,
);
console.log(
  "| scene | size | frames | layers / signals | mean | p50 | p95 | p99 | max | first | x realtime | read-back | RSS start → peak |",
);
console.log("|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of report) {
  console.log(
    `| ${r.scene} | ${r.width}×${r.height} | ${r.frames} | ${r.layers} / ${r.signals} | ${f(r.renderMs.mean)} | ${f(r.renderMs.p50)} | ${f(r.renderMs.p95)} | ${f(r.renderMs.p99)} | ${f(r.renderMs.max)} | ${f(r.firstFrameMs)} | ${f(r.fasterThanRealtime, 1)}× | ${f(r.readbackMs.mean)} | ${f(r.rssAfterBuildMB, 0)} → ${f(r.peakRssMB, 0)} MB, heap ${f(r.liveHeapMB, 0)} MB |`,
  );
}
console.log(
  "\n(times in ms per frame; read-back is copying the pixels out, not part of the frame time)\n",
);
for (const r of report) {
  console.log(
    `${r.scene}: scrubbing to ${r.scrub.probed} random frames in random order: ${r.scrub.identical} identical to the first pass, ${r.scrub.unreachable} older than the history${r.scrub.msPerFrame === null ? "" : `, ${f(r.scrub.msPerFrame)} ms per frame`}`,
  );
}

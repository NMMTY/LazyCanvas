#!/usr/bin/env node
// Benchmarks LazyCanvas and prints a report.
//
//   pnpm build && pnpm bench                       measure this checkout
//   pnpm bench --baseline main                     ...and compare it with another git ref
//   pnpm bench --rounds 5 --only complex,layout    pick scenarios and the number of rounds
//   pnpm bench --json bench.json                   keep every raw result
//
// Every scenario runs in its own process (scripts/bench/run-scenario.mjs), the two builds alternate
// round by round so that drift in the machine affects both alike, and the report gives the median
// over the rounds. Results on a shared machine are noisy: the spread between rounds is printed so
// that a difference smaller than it is not mistaken for a result. See scripts/bench/README.md.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const runner = join(here, "run-scenario.mjs");

/** Scenarios; `both` ones use only API that older versions have and can be compared with a baseline. */
const SCENARIOS = [
  { name: "simple", both: true, group: "render" },
  { name: "medium", both: true, group: "render" },
  { name: "medium-cache", both: true, group: "render" },
  { name: "complex", both: true, group: "render" },
  { name: "layout", both: true, group: "render" },
  { name: "layout-mixed", both: true, group: "render" },
  { name: "xform-none", both: true, group: "render" },
  { name: "xform-legacy", both: true, group: "render" },
  { name: "xform-origin", both: false, group: "render" },
  { name: "engine-100-plain", both: true, group: "engine" },
  { name: "engine-1000-plain", both: true, group: "engine" },
  { name: "engine-5000-plain", both: true, group: "engine" },
  { name: "engine-1000-watched", both: false, group: "engine" },
  { name: "engine-1000-nohistory", both: false, group: "engine" },
  { name: "engine-1000-step60", both: false, group: "engine" },
  { name: "memory-1000-watched", both: false, group: "memory" },
  { name: "memory-1000-nohistory", both: false, group: "memory" },
  { name: "seek-100-default", both: false, group: "seek" },
  { name: "seek-1000-default", both: false, group: "seek" },
  { name: "seek-1000-big", both: false, group: "seek" },
  { name: "extras", both: false, group: "extras" },
];

function parseArgs(argv) {
  const args = { rounds: 3, only: null, baseline: null, json: null, noanim: false };
  for (let i = 0; i < argv.length; i++) {
    const [key, inline] = argv[i].split("=");
    const value = () => inline ?? argv[++i];
    if (key === "--rounds") args.rounds = Number(value());
    else if (key === "--only") args.only = value().split(",");
    else if (key === "--baseline") args.baseline = value();
    else if (key === "--json") args.json = value();
    else if (key === "--no-animations") args.noanim = true;
    else if (key === "--help" || key === "-h") {
      console.log(
        "Usage: pnpm bench [--baseline <git-ref>] [--rounds N] [--only a,b] [--no-animations] [--json file]",
      );
      process.exit(0);
    } else throw new Error(`Unknown option ${argv[i]}`);
  }
  if (!(args.rounds >= 1)) throw new Error("--rounds must be at least 1");
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

/** A checkout of `ref` in a temporary directory, installed and built. */
function prepareBaseline(ref) {
  const dir = mkdtempSync(join(tmpdir(), "lazycanvas-baseline-"));
  console.error(`Preparing baseline ${ref} in ${dir} ...`);
  run("git", ["worktree", "add", "--detach", dir, ref], { cwd: repo });
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: dir });
  run("pnpm", ["build"], { cwd: dir });
  return {
    dir,
    remove() {
      spawnSync("git", ["worktree", "remove", "--force", dir], { cwd: repo });
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function measure(scenario, root, args) {
  const env = { ...process.env, LAZYCANVAS_ROOT: root };
  if (args.noanim) env.BENCH_NOANIM = "1";
  const out = run("node", ["--expose-gc", runner, scenario], { env, cwd: repo });
  return JSON.parse(out.trim().split("\n").pop());
}

const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const spread = (xs) =>
  xs.length > 1 && median(xs) ? ((Math.max(...xs) - Math.min(...xs)) / median(xs)) * 100 : 0;
const pick = (results, scenario, build, key) =>
  results
    .filter((r) => r.scenario === scenario && r.build === build && typeof r.data[key] === "number")
    .map((r) => r.data[key]);
const fmt = (n, digits = 2) => (n === undefined || Number.isNaN(n) ? "–" : n.toFixed(digits));

function report(results, args, hasBaseline) {
  const lines = [];
  const names = (group) =>
    SCENARIOS.filter((s) => s.group === group && (!args.only || args.only.includes(s.name))).map(
      (s) => s.name,
    );
  const section = (title) => lines.push("", `### ${title}`, "");

  const render = names("render");
  if (render.length) {
    section("Frame time, ms (median of rounds; spread = max−min over median)");
    lines.push(
      hasBaseline
        ? "| scenario | baseline | current | Δ | p95 base → cur | spread base / cur |"
        : "| scenario | mean | p50 | p95 | spread |",
    );
    lines.push(hasBaseline ? "|---|---:|---:|---:|---:|---:|" : "|---|---:|---:|---:|---:|");
    for (const name of render) {
      const cur = pick(results, name, "current", "mean");
      if (!cur.length) continue;
      if (hasBaseline) {
        const base = pick(results, name, "baseline", "mean");
        const delta = base.length ? `${((median(cur) / median(base) - 1) * 100).toFixed(0)}%` : "–";
        const p95b = pick(results, name, "baseline", "p95");
        const p95c = pick(results, name, "current", "p95");
        lines.push(
          `| ${name} | ${base.length ? fmt(median(base)) : "–"} | ${fmt(median(cur))} | ${delta} | ${p95b.length ? fmt(median(p95b)) : "–"} → ${fmt(median(p95c))} | ${base.length ? `${spread(base).toFixed(0)}%` : "–"} / ${spread(cur).toFixed(0)}% |`,
        );
      } else {
        lines.push(
          `| ${name} | ${fmt(median(cur))} | ${fmt(median(pick(results, name, "current", "p50")))} | ${fmt(median(pick(results, name, "current", "p95")))} | ${spread(cur).toFixed(0)}% |`,
        );
      }
    }
  }

  const engine = names("engine");
  if (engine.length) {
    section("Animation engine alone, ms per frame at 60 fps");
    lines.push("| scenario | baseline | current | current p95 |", "|---|---:|---:|---:|");
    for (const name of engine) {
      const cur = pick(results, name, "current", "mean");
      if (!cur.length) continue;
      const base = pick(results, name, "baseline", "mean");
      lines.push(
        `| ${name} | ${base.length ? fmt(median(base), 3) : "–"} | ${fmt(median(cur), 3)} | ${fmt(median(pick(results, name, "current", "p95")), 3)} |`,
      );
    }
  }

  const memory = names("memory");
  if (memory.length) {
    section("History memory: 1000 moving signals for 60 s");
    lines.push(
      "| scenario | heap growth, MB | frame mean, ms | frame p95, ms | worst frame, ms |",
      "|---|---:|---:|---:|---:|",
    );
    for (const name of memory) {
      const heap = pick(results, name, "current", "heapGrowthMB");
      if (!heap.length) continue;
      lines.push(
        `| ${name} | ${fmt(median(heap), 1)} | ${fmt(median(pick(results, name, "current", "mean")))} | ${fmt(median(pick(results, name, "current", "p95")))} | ${fmt(median(pick(results, name, "current", "max")), 1)} |`,
      );
    }
  }

  const other = [...names("seek"), ...names("extras")];
  if (other.length) {
    section("Seeking and the rest (median of rounds)");
    for (const name of other) {
      const rows = results
        .filter((r) => r.scenario === name && r.build === "current")
        .map((r) => r.data);
      if (!rows.length) continue;
      const parts = Object.keys(rows[0])
        .filter((k) => !["scenario", "count"].includes(k) && typeof rows[0][k] === "number")
        .map((k) => `${k} ${fmt(median(rows.map((r) => r[k])), 3)}`);
      lines.push(`- **${name}**: ${parts.join(", ")}`);
    }
  }
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const baseline = args.baseline ? prepareBaseline(args.baseline) : null;
const results = [];

try {
  const chosen = SCENARIOS.filter((s) => !args.only || args.only.includes(s.name));
  if (!chosen.length)
    throw new Error(
      `No scenario matches --only. Known: ${SCENARIOS.map((s) => s.name).join(", ")}`,
    );

  for (let round = 1; round <= args.rounds; round++) {
    for (const scenario of chosen) {
      const builds = [["current", repo]];
      if (baseline && scenario.both) builds.unshift(["baseline", baseline.dir]);
      for (const [build, root] of builds) {
        process.stderr.write(`round ${round}/${args.rounds}  ${scenario.name}  ${build}\r`);
        results.push({
          scenario: scenario.name,
          build,
          round,
          data: measure(scenario.name, root, args),
        });
      }
    }
  }
  process.stderr.write(`${" ".repeat(70)}\r`);

  const node = process.version;
  console.log(
    `LazyCanvas benchmark: ${args.rounds} round(s), Node ${node}${baseline ? `, baseline ${args.baseline}` : ""}${args.noanim ? ", animations off" : ""}`,
  );
  console.log(report(results, args, Boolean(baseline)));
  if (args.json) writeFileSync(args.json, `${JSON.stringify(results, null, 2)}\n`);
} finally {
  baseline?.remove();
}

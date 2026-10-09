#!/usr/bin/env node
/**
 * Verifies that what we would publish actually works.
 *
 * Packs every public package, checks the manifests inside the tarballs, runs
 * publint and "are the types wrong", installs the tarballs into a throwaway
 * project and loads every entry point through both `require` and `import`.
 *
 * Run after `pnpm build`:  node scripts/check-packages.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["lazycanvas", "adapter-node", "adapter-browser", "adapter-react"];
const bin = (name) => join(root, "node_modules", ".bin", name);

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

const work = mkdtempSync(join(tmpdir(), "lazycanvas-pack-"));
const packs = join(work, "packs");
const smoke = join(work, "smoke");
run("mkdir", ["-p", packs, smoke]);

try {
  // 1. Pack ---------------------------------------------------------------
  console.log("Packing");
  const tarballs = {};
  for (const dir of PACKAGES) {
    const pkgDir = join(root, "packages", dir);
    if (!existsSync(join(pkgDir, "dist"))) {
      fail(`${dir}: dist/ is missing — run "pnpm build" first`);
      continue;
    }
    run("pnpm", ["pack", "--pack-destination", packs], { cwd: pkgDir });
  }
  for (const file of readdirSync(packs)) tarballs[file] = join(packs, file);
  if (Object.keys(tarballs).length !== PACKAGES.length) fail("expected one tarball per package");

  // 2. Manifest rules ---------------------------------------------------
  console.log("Manifests");
  for (const [file, path] of Object.entries(tarballs)) {
    const manifest = JSON.parse(run("tar", ["-xzOf", path, "package/package.json"]));
    const label = manifest.name;
    const all = JSON.stringify({
      d: manifest.dependencies,
      p: manifest.peerDependencies,
      o: manifest.optionalDependencies,
    });
    if (all.includes("workspace:")) fail(`${label}: "workspace:" protocol leaked into the tarball`);
    for (const [dep, range] of Object.entries(manifest.peerDependencies ?? {})) {
      if (dep.startsWith("@nmmty/") && !String(range).startsWith("^")) {
        fail(`${label}: peer "${dep}" is "${range}", expected a caret range`);
      }
    }
    for (const field of ["license", "repository", "homepage", "engines", "description"]) {
      if (!manifest[field]) fail(`${label}: missing "${field}"`);
    }
    if (manifest.publishConfig?.access !== "public")
      fail(`${label}: publishConfig.access must be "public"`);
    const files = run("tar", ["-tzf", path]).split("\n");
    for (const required of ["package/LICENSE", "package/README.md"]) {
      if (!files.includes(required)) fail(`${label}: ${required.slice(8)} is not in the tarball`);
    }
    if (files.some((f) => /\.(ts|tsx)$/.test(f) && !/\.d\.(m?ts)$/.test(f))) {
      fail(`${label}: raw TypeScript sources are in the tarball`);
    }
    ok(`${label} ${manifest.version} (${file})`);
  }

  // 3. publint + attw ---------------------------------------------------
  console.log("publint / are-the-types-wrong");
  for (const path of Object.values(tarballs)) {
    const label = path.split("/").pop();
    try {
      const out = run(bin("publint"), ["run", path, "--strict"]);
      ok(`publint ${label}`);
      void out;
    } catch (e) {
      fail(`publint ${label}:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
    }
    try {
      run(bin("attw"), [path, "--profile", "node16", "--no-emoji"]);
      ok(`attw ${label}`);
    } catch (e) {
      fail(`attw ${label}:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
    }
  }

  // 4. Install into a clean project and load every entry point ------------
  console.log("Install + load");
  writeFileSync(
    join(smoke, "package.json"),
    JSON.stringify({ name: "smoke", private: true, version: "0.0.0" }),
  );
  run(
    "npm",
    ["install", "--no-audit", "--no-fund", ...Object.values(tarballs), "react@19", "react-dom@19"],
    { cwd: smoke },
  );

  const entries = [
    "@nmmty/lazycanvas",
    "@nmmty/lazycanvas/node",
    "@nmmty/lazycanvas/fonts",
    "@nmmty/lazycanvas/jsx-runtime",
    "@nmmty/lazycanvas/jsx-dev-runtime",
    "@nmmty/adapter-node",
    "@nmmty/adapter-browser",
    "@nmmty/adapter-react",
  ];
  writeFileSync(
    join(smoke, "load.cjs"),
    `const entries = ${JSON.stringify(entries)};
for (const e of entries) { const m = require(e); if (!Object.keys(m).length) throw new Error(e + " has no exports"); }
console.log("cjs ok");`,
  );
  writeFileSync(
    join(smoke, "load.mjs"),
    `const entries = ${JSON.stringify(entries)};
for (const e of entries) { const m = await import(e); if (!Object.keys(m).length) throw new Error(e + " has no exports"); }
console.log("esm ok");`,
  );
  // The two entry points share classes: Exporter checks \`instanceof Scene\`.
  const render = (load) => `
${load("lc", "@nmmty/lazycanvas")}
${load("node", "@nmmty/lazycanvas/node")}
${load("an", "@nmmty/adapter-node")}
const scene = new lc.Scene(40, 40, { adapter: new an.NodeCanvasAdapter() });
scene.load(new lc.Div().add(new lc.MorphLayer({ color: "#ff0000", size: { width: 40, height: 40 } })));
const png = await new node.Exporter(scene).export("png");
if (!(png && png.length > 50)) throw new Error("Exporter produced no PNG");
console.log("render ok");`;
  writeFileSync(
    join(smoke, "render.mjs"),
    render((v, m) => `const ${v} = await import("${m}");`),
  );
  writeFileSync(
    join(smoke, "render.cjs"),
    `(async () => {${render((v, m) => `const ${v} = require("${m}");`)}})().catch((e) => { console.error(e); process.exit(1); });`,
  );
  for (const script of ["load.cjs", "load.mjs", "render.cjs", "render.mjs"]) {
    try {
      ok(`${script}: ${run("node", [script], { cwd: smoke }).trim()}`);
    } catch (e) {
      fail(`${script}:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
    }
  }

  // 5. The browser entry points must not pull in Node built-ins ---------
  console.log("Browser bundle");
  const esbuild = run("sh", [
    "-c",
    `ls -d ${root}/node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | head -1`,
  ]).trim();
  writeFileSync(
    join(smoke, "browser.mjs"),
    `import { Scene, MorphLayer } from "@nmmty/lazycanvas";
import { BrowserCanvasAdapter } from "@nmmty/adapter-browser";
console.log(Scene, MorphLayer, BrowserCanvasAdapter);`,
  );
  try {
    const meta = join(smoke, "meta.json");
    run(
      esbuild,
      [
        "browser.mjs",
        "--bundle",
        "--platform=browser",
        "--format=esm",
        "--external:yoga-layout",
        `--metafile=${meta}`,
        `--outfile=${join(smoke, "out.js")}`,
      ],
      { cwd: smoke },
    );
    const bundle = readFileSync(join(smoke, "out.js"), "utf8");
    const leaked = [...new Set(bundle.match(/"node:[a-z/_]+"/g) ?? [])];
    if (leaked.length) fail(`browser bundle references Node built-ins: ${leaked.join(", ")}`);
    else ok("no node: built-ins in the browser bundle");
  } catch (e) {
    fail(`browser bundle:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s) found.`);
  process.exit(1);
}
console.log("\nAll package checks passed.");

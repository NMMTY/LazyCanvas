#!/usr/bin/env node
/**
 * Release guard: the four public packages must share one version, and when a
 * tag is given it must be `v<version>`.
 *
 *   node scripts/check-release.mjs [v1.2.3]
 *
 * Prints the npm dist-tag to publish under: `latest` for a stable version,
 * `next` for a prerelease.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["lazycanvas", "adapter-node", "adapter-browser", "adapter-react"];

const versions = PACKAGES.map((dir) => {
  const manifest = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
  return { name: manifest.name, version: manifest.version };
});

const [{ version }] = versions;
const mismatched = versions.filter((p) => p.version !== version);
if (mismatched.length) {
  console.error("The public packages must share one version:");
  for (const p of versions) console.error(`  ${p.name}@${p.version}`);
  process.exit(1);
}

const tag = process.argv[2];
if (tag && tag !== `v${version}`) {
  console.error(`Tag ${tag} does not match the package version ${version} (expected v${version}).`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`"${version}" is not a valid semver version.`);
  process.exit(1);
}

const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const base = version.split("-")[0];
if (!new RegExp(`^## \\[${base.replaceAll(".", "\\.")}\\]`, "m").test(changelog)) {
  console.error(`CHANGELOG.md has no "## [${base}]" section.`);
  process.exit(1);
}

console.log(version.includes("-") ? "next" : "latest");

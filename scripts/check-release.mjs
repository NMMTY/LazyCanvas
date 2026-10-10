#!/usr/bin/env node
/**
 * Release planner and guard.
 *
 *   node scripts/check-release.mjs [v1.2.3] [--offline]
 *
 * The public packages are versioned independently. A package is released when
 * the version in its package.json is not on npm yet; packages whose version is
 * already published are skipped, so only what you bumped is published.
 *
 * Checks:
 *  - every version is valid semver;
 *  - something is left to publish;
 *  - the tag, when given, is `v<version>` of a package that will be published;
 *  - CHANGELOG.md has a section for that version.
 *
 * Prints the plan as JSON on stdout (`[{ name, dir, version, distTag }]`, with
 * `distTag` being `next` for prereleases and `latest` otherwise). Everything
 * else goes to stderr. `--offline` skips the registry lookup and treats every
 * package as unpublished (for a local dry run).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES } from "./packages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const offline = args.includes("--offline");
const tag = args.find((arg) => !arg.startsWith("--"));

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** Whether `name@version` is already on the registry. */
function isPublished(name, version) {
  if (offline) return false;
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim().length > 0;
  } catch (error) {
    const text = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    // A missing version, or a package that was never published, is a 404.
    if (/E404|404 Not Found|is not in this registry/i.test(text)) return false;
    return fail(`Could not ask npm about ${name}@${version}:\n${text || error.message}`);
  }
}

const packages = PACKAGES.map((dir) => {
  const manifest = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
  if (!SEMVER.test(manifest.version)) {
    fail(`${manifest.name}: "${manifest.version}" is not a valid semver version.`);
  }
  return { name: manifest.name, dir, version: manifest.version };
});

const plan = [];
for (const pkg of packages) {
  if (isPublished(pkg.name, pkg.version)) {
    console.error(`skip     ${pkg.name}@${pkg.version} (already on npm)`);
  } else {
    console.error(`publish  ${pkg.name}@${pkg.version}`);
    plan.push({ ...pkg, distTag: pkg.version.includes("-") ? "next" : "latest" });
  }
}

if (plan.length === 0) {
  fail("Nothing to publish: every package version is already on npm. Bump a version first.");
}

if (tag && !plan.some((pkg) => tag === `v${pkg.version}`)) {
  fail(
    `Tag ${tag} matches none of the versions about to be published: ${plan
      .map((pkg) => `${pkg.name}@${pkg.version}`)
      .join(", ")}.`,
  );
}

if (tag) {
  const base = tag.slice(1).split("-")[0];
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  if (!new RegExp(`^## \\[${base.replaceAll(".", "\\.")}\\]`, "m").test(changelog)) {
    fail(`CHANGELOG.md has no "## [${base}]" section.`);
  }
}

console.log(JSON.stringify(plan));

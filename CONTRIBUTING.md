# Contributing to LazyCanvas

Thanks for helping! This document covers how to set the repository up, what a good change looks like and how releases are made.

## Setup

You need Node.js 22 and [pnpm](https://pnpm.io) 10 (`corepack enable` picks the right version).

```bash
git clone https://github.com/NMMTY/LazyCanvas.git
cd LazyCanvas
pnpm install
pnpm build
```

## Repository layout

| Path | What lives there |
| --- | --- |
| `packages/lazycanvas` | The core |
| `packages/adapter-node`, `adapter-browser`, `adapter-react` | Environment adapters |
| `packages/micro-docgen` | The API-reference generator used by the docs (not part of the 1.0 release) |
| `apps/docs` | The documentation site (Next.js + MDX) |
| `apps/test` | A Next.js playground used to try the React adapter in a real bundler |
| `scripts/check-packages.mjs` | Verifies the packed tarballs |

## Everyday commands

```bash
pnpm test             # vitest; imports the TypeScript sources, no build needed
pnpm lint             # biome check (pnpm lint:fix to fix)
pnpm typecheck        # needs `pnpm build` first: adapters typecheck against the core's emitted types
pnpm build            # tsup: ESM + CJS + declarations for every package
pnpm check:packages   # pack, publint, attw, install into a clean project, load every entry point
pnpm --filter @nmmty/lazycanvas-docs dev   # documentation site
pnpm --filter @nmmty/lazycanvas-test dev   # playground
```

CI runs lint, build, typecheck, tests and `check:packages` on every pull request.

## Making a change

1. Open an issue first for anything bigger than a bug fix, so we can agree on the approach.
2. Add or update tests next to the code (`packages/<name>/test`). Rendering tests read pixels back
   from a real canvas rather than mocking the drawing calls.
3. Keep the public API documented with JSDoc — it becomes the API reference.
4. If the change is visible to users, add a line under **Unreleased** in [CHANGELOG.md](./CHANGELOG.md),
   and update the guides in `apps/docs/src/content/docs` when behaviour changes.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(text): …`, `fix: …`, `docs: …`).

### Things to keep in mind

- The main entry point of `@nmmty/lazycanvas` must stay free of Node.js built-ins. Anything that
  needs `node:fs` and friends belongs in `@nmmty/lazycanvas/node`. `pnpm check:packages` verifies this.
- The core never imports a concrete canvas. Go through `ICanvasAdapter`.
- Entry points share classes through bundler chunks (`Exporter` checks `instanceof Scene`); do not
  turn a subpath into a separate bundle.
- Public peer ranges between packages use `workspace:^`, which publishes as `^x.y.z`.

## Releasing

The four public packages are versioned independently. A release publishes the packages whose
`version` is not on npm yet and skips the rest, so bump only what changed.

1. Bump `version` in the `package.json` of each package that changed (follow semver; a package
   that depends on another through a peer range does not need a bump unless it changed itself).
2. Move the **Unreleased** notes in `CHANGELOG.md` under a section for the new version, saying
   which packages it applies to.
3. Run `pnpm install && pnpm build && pnpm test && pnpm check:packages` locally, and
   `node scripts/check-release.mjs v1.2.3` (`--offline` to skip the npm lookup) to see what would be
   published and to check that the tag and the changelog match.
4. Merge to `main`, then tag with the version of a package being published:
   `git tag v1.2.3 && git push origin v1.2.3`.
5. The `Release` workflow re-runs every check, publishes each package from the plan with
   provenance and creates the GitHub release. Prerelease versions (`1.1.0-rc.1`) go to the `next`
   dist-tag, everything else to `latest`. It needs an `NPM_TOKEN` repository secret.

## Code of conduct

Be kind and assume good faith. Harassment of any kind is not tolerated.

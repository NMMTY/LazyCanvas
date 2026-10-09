<p align="center">
  <img src="https://raw.githubusercontent.com/NMMTY/LazyCanvas/main/packages/lazycanvas/resources/logo.svg" alt="LazyCanvas" width="320" />
</p>

<p align="center">
  Declarative 2D canvas rendering with flexbox layout, JSX and signal-based animation —<br />
  for <b>Node.js</b>, the <b>browser</b> and <b>React</b>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nmmty/lazycanvas"><img src="https://img.shields.io/npm/v/@nmmty/lazycanvas.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@nmmty/lazycanvas"><img src="https://img.shields.io/npm/dm/@nmmty/lazycanvas.svg" alt="downloads" /></a>
  <a href="https://github.com/NMMTY/LazyCanvas/actions/workflows/ci.yml"><img src="https://github.com/NMMTY/LazyCanvas/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@nmmty/lazycanvas.svg" alt="license" /></a>
</p>

## Packages

| Package | Description |
| --- | --- |
| [`@nmmty/lazycanvas`](./packages/lazycanvas) | The core: `Scene`, layers, flexbox layout, signals, animation, export |
| [`@nmmty/adapter-node`](./packages/adapter-node) | Node.js adapter built on [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) |
| [`@nmmty/adapter-browser`](./packages/adapter-browser) | Browser adapter built on the native `HTMLCanvasElement` |
| [`@nmmty/adapter-react`](./packages/adapter-react) | React bindings: `<Scene>` and layer components |

The core knows nothing about a concrete canvas. Install it together with the adapter for where your code runs:

```bash
# Node.js
npm install @nmmty/lazycanvas @nmmty/adapter-node
# Browser
npm install @nmmty/lazycanvas @nmmty/adapter-browser
# React / Next.js
npm install @nmmty/lazycanvas @nmmty/adapter-browser @nmmty/adapter-react
```

## A taste

```tsx
// React
import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";

<Scene width={320} height={96}>
  <Group layout={{ width: 320, height: 96, justifyContent: "center", alignItems: "center" }}>
    <Morph
      color="#7c3aed"
      size={{ width: 320, height: 96, radius: { all: 20 } }}
      layout={{ position: "absolute", top: 0, left: 0 }}
    />
    <Text text="Hello, LazyCanvas!" color="#fff" font={{ family: "sans-serif", size: 28, weight: 700 }} align="center" />
  </Group>
</Scene>;
```

```ts
// Node.js — the same layers, exported to a PNG
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Div, MorphLayer, Scene } from "@nmmty/lazycanvas";
import { Exporter } from "@nmmty/lazycanvas/node";

const scene = new Scene(320, 96, { adapter: new NodeCanvasAdapter() });
scene.load(new Div().add(new MorphLayer({ color: "#7c3aed", size: { width: 320, height: 96 } })));
await new Exporter(scene).export("png", { name: "badge", saveAsFile: true });
```

## Documentation

- [Guides and API reference](./apps/docs/src/content/docs)
- [Migrating from 0.6.x](./apps/docs/src/content/docs/migration-from-0.6.mdx)
- [Changelog](./CHANGELOG.md)

## Development

This is a [pnpm](https://pnpm.io) workspace. You need Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm build          # build every package
pnpm test           # vitest, runs against the TypeScript sources
pnpm lint           # biome
pnpm typecheck
pnpm check:packages # pack, install into a clean project and load every entry point
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and how releases are made.

## License

[MIT](./LICENSE) © NMMTY

# @nmmty/adapter-node

[![npm version](https://img.shields.io/npm/v/@nmmty/adapter-node.svg)](https://www.npmjs.com/package/@nmmty/adapter-node)
[![license](https://img.shields.io/npm/l/@nmmty/adapter-node.svg)](https://github.com/NMMTY/LazyCanvas/blob/main/LICENSE)

Node.js adapter for [`@nmmty/lazycanvas`](https://github.com/NMMTY/LazyCanvas/tree/main/packages/lazycanvas), powered by [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) — a fast, dependency-free Skia binding with prebuilt binaries for Linux, macOS and Windows.

## Installation

```bash
npm install @nmmty/lazycanvas @nmmty/adapter-node
```

Requires Node.js 18 or newer. `@napi-rs/canvas` is installed automatically.

## Usage

```ts
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { MorphLayer, Scene } from "@nmmty/lazycanvas";
import { Exporter } from "@nmmty/lazycanvas/node";

const scene = new Scene(400, 200, { adapter: new NodeCanvasAdapter() });
scene.load(new MorphLayer({ color: "#22c55e", size: { width: 400, height: 200 } }));

await new Exporter(scene).export("png", { name: "out", saveAsFile: true });
```

## What the adapter provides

| Member | Description |
| --- | --- |
| `createCanvas(width, height)` | A new `@napi-rs/canvas` `Canvas` |
| `loadImage(source)` | Decodes a URL, file path, `Buffer` or `Uint8Array` |
| `fonts.registerFromPath(path, family)` | Registers a font file; returns `false` instead of throwing if it cannot be read |
| `fonts.register(base64, family)` | Registers a base64-encoded font |
| `fonts.has(family)` / `fonts.families` | Inspect the registered families |
| `Path2D` | The `@napi-rs/canvas` `Path2D` constructor (Node has no global one) |

## Bundled fonts

```ts
import { Fonts } from "@nmmty/lazycanvas/fonts";

scene.lazyCanvas.manager.fonts.loadFonts(Fonts); // Geist and Geist Mono
```

## License

[MIT](./LICENSE) © NMMTY

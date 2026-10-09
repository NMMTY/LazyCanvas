# @nmmty/adapter-browser

[![npm version](https://img.shields.io/npm/v/@nmmty/adapter-browser.svg)](https://www.npmjs.com/package/@nmmty/adapter-browser)
[![license](https://img.shields.io/npm/l/@nmmty/adapter-browser.svg)](https://github.com/NMMTY/LazyCanvas/blob/main/LICENSE)

Browser adapter for [`@nmmty/lazycanvas`](https://github.com/NMMTY/LazyCanvas/tree/main/packages/lazycanvas). It draws on a native `HTMLCanvasElement`, loads images through `Image` and fonts through the CSS Font Loading API. It has no dependencies and no Node.js built-ins.

## Installation

```bash
npm install @nmmty/lazycanvas @nmmty/adapter-browser
```

## Usage

```ts
import { BrowserCanvasAdapter } from "@nmmty/adapter-browser";
import { MorphLayer, Scene } from "@nmmty/lazycanvas";

const canvas = document.querySelector("canvas")!;
const adapter = new BrowserCanvasAdapter(canvas); // omit the argument to create a detached canvas
const scene = new Scene(400, 200, { adapter });

scene.load(new MorphLayer({ color: "#22c55e", size: { width: 400, height: 200 } }));
await scene.renderFrame(0);
```

When you pass an element, the scene resizes and draws on that element.

## Fonts

Declare families with CSS `@font-face` and refer to them by name. The browser does not download a font until something renders with it, and a canvas does not count, so ask the adapter to load what the scene needs before the first frame:

```ts
await adapter.loadFonts(['700 32px "Inter"', '400 16px "Inter"']);
await scene.renderFrame(0);
```

Fonts registered from base64 (for example `scene.lazyCanvas.manager.fonts.loadFonts(Fonts)`) load asynchronously; `await adapter.fontsReady()` before the first frame. `<Scene>` from `@nmmty/adapter-react` does both for you.

`fonts.registerFromPath` is not supported in the browser and returns `false`.

## Images

`loadImage` accepts a URL, a data URL, an `ArrayBuffer` or a typed array. Images are requested with `crossOrigin = "anonymous"`, so remote hosts must send CORS headers — otherwise the canvas is tainted and cannot be exported.

## Bundlers

`@nmmty/lazycanvas` loads Yoga through a top-level `await`; see [Bundlers](https://github.com/NMMTY/LazyCanvas/tree/main/packages/lazycanvas#bundlers) for the webpack/Next.js settings.

## License

[MIT](./LICENSE) © NMMTY

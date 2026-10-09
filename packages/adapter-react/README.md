# @nmmty/adapter-react

[![npm version](https://img.shields.io/npm/v/@nmmty/adapter-react.svg)](https://www.npmjs.com/package/@nmmty/adapter-react)
[![license](https://img.shields.io/npm/l/@nmmty/adapter-react.svg)](https://github.com/NMMTY/LazyCanvas/blob/main/LICENSE)

React bindings for [`@nmmty/lazycanvas`](https://github.com/NMMTY/LazyCanvas/tree/main/packages/lazycanvas): describe a canvas scene with JSX components, and it is redrawn whenever your props or state change.

## Installation

```bash
npm install @nmmty/lazycanvas @nmmty/adapter-browser @nmmty/adapter-react
```

Requires React 18 or newer. The package is marked `"use client"`, so it can be imported from Next.js App Router files.

## Usage

```tsx
import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";

export function Badge({ name }: { name: string }) {
  return (
    <Scene width={320} height={96}>
      <Group layout={{ width: 320, height: 96, justifyContent: "center", alignItems: "center" }}>
        <Morph
          color="#7c3aed"
          size={{ width: 320, height: 96, radius: { all: 20 } }}
          layout={{ position: "absolute", top: 0, left: 0 }}
        />
        <Text
          text={`Hello, ${name}!`}
          color="#ffffff"
          font={{ family: "sans-serif", size: 28, weight: 700 }}
          align="center"
        />
      </Group>
    </Scene>
  );
}
```

`<Scene>` renders a single `<canvas>`. Its children are layer descriptions, not DOM: they are turned into LazyCanvas layers and drawn onto that canvas. Changing a prop (for example from `useState`) redraws the canvas.

## Components

| Component | Layer |
| --- | --- |
| `Morph` | `MorphLayer` — rectangles with rounded corners and strokes |
| `Text` | `TextLayer` |
| `Image` | `ImageLayer` |
| `Line`, `Bezier`, `Quadratic` | `LineLayer`, `BezierLayer`, `QuadraticLayer` |
| `Polygon` | `PolygonLayer` |
| `Path2D` | `Path2DLayer` |
| `Group` | `Div` — a flexbox container for other layers |

Layer props are the same as the props accepted by the layer classes in `@nmmty/lazycanvas`. Only these components, fragments and `registerLayer`/`createLayerComponent` wrappers are drawn; arbitrary React components and DOM elements among the children are ignored.

### `<Scene>` props

| Prop | Type | Description |
| --- | --- | --- |
| `width`, `height` | `number` | Canvas size in pixels (required) |
| `className`, `style` | | Passed to the `<canvas>` element |
| `autoRender` | `boolean` (default `true`) | Draw automatically when children change |
| `animated` | `boolean \| number` | `true` loops the scene's animations forever, a number plays that many loops |
| `adapter` | `ICanvasAdapter` | Use a different adapter than the default `BrowserCanvasAdapter` |
| `onReady` | `(scene, canvas) => void` | Called once the scene exists — the place to register animations |
| `onFrame` | `(scene) => void` | Called after every drawn frame |
| `debug` | `boolean` | Verbose logging |

A `ref` gives you a `SceneRef` with `renderFrame(time)`, `playAnimation`, `addAnimation`, `clearAnimations`, `resetTimeline`, `getLayer(id)` and the underlying `scene`.

## Animation

```tsx
import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Easing, all, createSignal } from "@nmmty/lazycanvas";
import { useMemo } from "react";

export function Slider() {
  const x = useMemo(() => createSignal(20), []);
  const color = useMemo(() => createSignal("#ef4444"), []);

  return (
    <Scene
      width={320}
      height={100}
      animated
      onReady={(scene) =>
        scene.addAnimation(function* () {
          yield* all(x.to(240, 1.2, { easing: Easing.easeInOutCubic }), color.to("#3b82f6", 1.2));
          yield* all(x.to(20, 1.2, { easing: Easing.easeInOutCubic }), color.to("#ef4444", 1.2));
        })
      }
    >
      <Group>
        <Morph color="#0f172a" size={{ width: 320, height: 100, radius: { all: 16 } }} />
        <Morph color={color} position={{ x, y: 30 }} size={{ width: 40, height: 40, radius: { all: 8 } }} />
      </Group>
    </Scene>
  );
}
```

## Custom layers

```tsx
import { registerLayer } from "@nmmty/adapter-react";
import { MyLayer } from "./MyLayer";

export const My = registerLayer("MyLayer", MyLayer);
```

## Fonts

`<Scene>` collects the fonts used by its text layers and loads them through the browser adapter before the first frame, so a CSS `@font-face` family is ready when it is first drawn. Declare the family with `@font-face` (or `next/font`) and use its name in `font.family`.

## Next.js

Add the packages to `transpilePackages` and enable top-level await for Yoga:

```js
// next.config.mjs
export default {
  transpilePackages: ["@nmmty/lazycanvas", "@nmmty/adapter-browser", "@nmmty/adapter-react"],
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    return config;
  },
};
```

The scene is created in an effect, so nothing is drawn during server rendering.

## License

[MIT](./LICENSE) © NMMTY

# Changelog

All notable changes to the published packages are documented here. The four
packages — `@nmmty/lazycanvas`, `@nmmty/adapter-node`, `@nmmty/adapter-browser`
and `@nmmty/adapter-react` — are versioned independently: a release only
contains the packages whose version was bumped, and each entry below names the
packages it applies to.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0]

`@nmmty/lazycanvas`, `@nmmty/adapter-browser` and `@nmmty/adapter-react`; `@nmmty/adapter-node` stays at 1.0.0.

### Added

- **`Scene.renderLatest(time, roots?)`** (`@nmmty/lazycanvas`): renders a frame that replaces the
  previous ones, for a scene that is redrawn faster than it can be drawn. A frame that has started is
  finished; of the requests waiting behind it only the newest is drawn, and the layer trees passed as
  `roots` are swapped in between frames, never under a running one. Resolves to `false` if a newer
  request replaced it.
- **`onFrameDrawn` option of `Scene`** (`@nmmty/lazycanvas`): called after each completely drawn
  frame, while the canvas still holds exactly that frame.
- **Image cache** (`@nmmty/adapter-browser`): `loadImage` reuses the image already loaded for a URL
  (up to 64, least recently used first out), and frames that ask while it is loading share one request.
  Failed loads are not kept. Turn it off with `new BrowserCanvasAdapter(canvas, { imageCache: false })`
  or empty it with `clearImageCache()`.

- **Layer cache** (`@nmmty/lazycanvas`, `@nmmty/adapter-react`): `new Scene(w, h, { adapter, cache: true })`
  keeps the picture of layers between frames. A layer is looked up by what it looks like (type, props
  after layout, canvas size, current transform), so layer objects that are created anew for every frame
  still find the picture of the last one. A layer whose values are all the same is copied instead of
  drawn; a blurred shape of one flat colour whose only change is the colour is repainted from its stored
  blurred outline instead of being blurred again. Stored by default: layers with a `filter`; `cache: true`
  / `cache: false` on a layer (including a `Group`) overrides it. Layers with a `Link`, a function or a
  `Buffer` among their props, with `clipPath`, and images are never stored. Limits: `maxBytes` (64 MiB)
  and `maxEntries` (64) in `LayerCacheOptions`; `scene.cacheStats()` and `scene.clearCache()`.
  `<Scene cache>` is on by default; `cache={false}` restores drawing every layer in every frame.

### Changed

- **`<Scene>` no longer shows half-drawn frames** (`@nmmty/adapter-react`): it draws on a detached back
  buffer and copies each finished frame to the page canvas in one step. A scene redrawn in quick
  succession (a live preview next to a colour picker) used to show whatever part of the frame had been
  drawn when the browser painted. `onReady` and `useScene()` still receive the `<canvas>` element on the
  page; `onFrame` runs before the frame is copied, so anything drawn there on `scene.lazyCanvas` is
  included. A scene given its own `adapter` draws on that adapter's surface as before.
- **A burst of changes costs one frame in flight plus one more**, not one per change
  (`@nmmty/adapter-react`, through `renderLatest`). Previously every change queued a full frame and the
  final state appeared only after all of them.
- `BrowserCanvasAdapter.loadFonts` skips fonts the browser has already loaded instead of asking again
  before every frame.

## [1.0.1]

`@nmmty/lazycanvas` only; the adapters stay at 1.0.0.

### Added

- **`ImageLayer` placeholder**: an image that cannot be loaded is drawn as a placeholder
  (a box with a cross, in the layer's size and with its rounded corners; style it with
  `placeholder: { color, stroke }`) and a warning is logged, instead of aborting the frame.
  `placeholder: false` restores the error.

### Fixed

- A layer that throws while drawing no longer stops the layers after it: the frame is
  completed and the first error is reported afterwards.
- A failing layer no longer leaves the canvas context transformed. A `Group` that had
  translated the context never undid it, so the next frame was drawn shifted and the previous
  one was left behind, which showed up as layers drawn twice with an offset. Every layer
  restores the context in a `finally`, and `Scene` resets the transform before each frame.

## [1.0.0]

LazyCanvas 1.0 is a ground-up rework of the 0.6 line. **It contains breaking
changes** — read the [migration guide](./apps/docs/src/content/docs/migration-from-0.6.mdx)
before upgrading.

### Added

- **Adapters.** The core no longer depends on `@napi-rs/canvas`. Pick an adapter for your
  environment: `@nmmty/adapter-node`, `@nmmty/adapter-browser`, or `@nmmty/adapter-react` for React.
- **`Scene`** as the main entry point: load a layer tree, render any frame, drive animations.
- **Flexbox layout** through Yoga: a `layout` prop on every layer (`flexDirection`, `gap`,
  `padding`, `justifyContent`, `alignItems`, absolute positioning, …) and `Group` as the container.
- **JSX**, with both the classic (`/** @jsx createElement */`) and the automatic
  (`jsxImportSource: "@nmmty/lazycanvas"`) runtimes.
- **Signals and generator-based animation**: `createSignal`, tweens, `Easing`, `all`, `chain`,
  `loop`, `waitFor`, `spring`, `timeline`, …
- **APNG export**, and `renderFrame`/`renderAnimation` to render any point of the timeline.
- **Vertical text** (`direction: "ttb" | "btt"`) with word and ideograph modes.
- **`@nmmty/adapter-react`**: `<Scene>`, `Morph`, `Text`, `Image`, `Line`, `Bezier`,
  `Quadratic`, `Polygon`, `Path2D`, `Group`, and `registerLayer` for your own layers.
- ESM **and** CommonJS builds of every package, with conditional `exports` and types for both.
- Package READMEs, a documentation site with live examples, and a 0.6 → 1.0 migration guide.

### Changed

- **Breaking:** `new LazyCanvas(...)` and `new Scene(...)` require an `adapter`.
- **Breaking:** `Exporter`, `APNGEncoder`, `readJSONFile` and `readYAMLFile` moved to
  `@nmmty/lazycanvas/node`; the main entry point has no Node.js built-ins.
- **Breaking:** the bundled Geist fonts moved from the main entry point to
  `@nmmty/lazycanvas/fonts` and are opt-in. They are plain base64 strings, and font data in
  general may be a `string` or a `Uint8Array` — `Buffer` is no longer required.
- **Breaking:** `ClassicRenderPipeline` is deprecated; `Scene` always uses `ModernRenderPipeline`.
- The main entry point no longer re-exports internal helpers; only `LazyError`, the font, tree,
  `Path2D` and vertical-text utilities remain.
- Peer dependencies between the packages are caret ranges (`^1.0.0`).

### Removed

- **Breaking:** `PluginManager` and the plugin hooks.
- **Breaking:** `AnimationManager` and the frame-based animation settings (replaced by signals).
- **Breaking:** `ClearLayer`.
- **Breaking:** the `RenderManager` class (replaced by render pipelines).
- **Breaking:** GIF and SVG export, and `Export.JPEG` (use `Export.JPG`).

[Unreleased]: https://github.com/NMMTY/LazyCanvas/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/NMMTY/LazyCanvas/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/NMMTY/LazyCanvas/releases/tag/v1.0.0

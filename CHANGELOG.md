# Changelog

All notable changes to the published packages are documented here. The four
packages — `@nmmty/lazycanvas`, `@nmmty/adapter-node`, `@nmmty/adapter-browser`
and `@nmmty/adapter-react` — are versioned independently: a release only
contains the packages whose version was bumped, and each entry below names the
packages it applies to.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`@nmmty/lazycanvas`.

### Added
- **`scene.frames(start, end, fps, { reuse })`** (`@nmmty/lazycanvas`): an async generator that hands over
  the frames of a range one at a time. An export of any length takes the memory of one frame (with `reuse`,
  one buffer for all of them). `scene.getImageData(into)` copies into a buffer you already have.

- **Moving the timeline to any time** (`@nmmty/lazycanvas`): `scene.renderFrame(t)` now accepts any
  `t`, in any order, and shows what playing from the start would show at `t`. The scheduler remembers
  what happens to animated signals, ten minutes or a million recorded changes, whichever is reached first
  (`new Scene(w, h, { history: { maxSeconds, maxEntries } })` to change it, `history: false` to turn it
  off, after which going back in time throws). A change is a value being set or an animation starting or
  ending on a signal, so a tween that runs for ten minutes is two entries. `ThreadScheduler` and
  `SignalTrace` are exported.
- **`new Scene(w, h, { timeStep })`**: the grid, `1/240` s by default, that generators doing a bare `yield` are
  resumed on. Nothing else runs on it.
- **`scene.duration`**: the length of the animations added as functions, measured without leaving the
  signals at their end values. `Exporter` uses it as the default `duration` of an APNG export.
- `Signal.restore(value, velocity?)`, `BaseLayer.listSignals()`.
- For writing animations that sleep: `Clock`, `requireClock()`, `currentClock()`, `ThreadScheduler.runToEnd()`.
- **Springs** (`@nmmty/lazycanvas`): `signal.spring(target, config | preset)` moves a signal by physics.
  The damped spring is solved exactly (under-, critically and over-damped), so it is the same at any frame
  rate and on any seek. `stiffness`, `damping`, `mass`, `velocity`, `restDelta`, `restSpeed`; presets
  `default`, `gentle`, `wobbly`, `stiff`, `snappy`, `slow`, `molasses` in `SpringPresets`. A numeric signal
  that is moving keeps its speed (`signal.velocity()`) when a spring takes over. Works for numbers, colours
  and `{ x, y }` points. `solveSpring()` returns the motion as a function of time.
- **Keyframes**: `signal.keyframes(frames, options)` and the `Keyframes` class (`valueAt(t)` is a pure
  function of time). Keyframes are `{ at | offset, value, easing? }` or plain values spread over `duration`;
  an easing applies to the stretch that starts at its keyframe, as in CSS.
- **Timeline positions**: `timeline().add(animation, position)` with GSAP-style positions (`2`, `"<"`,
  `">"`, `"+=0.5"`, `"<+=0.2"`, labels with `label(name)`), nested timelines and `timeline.duration`.
  `durationOf(animation)` gives the length of what `to`, `spring`, `keyframes`, `waitFor`, `all`, `chain`,
  `delay`, `loopFor`, `sequence`, `yoyo` and timelines make.
- **`Playhead`**: the clock of a player (play, pause, reverse, seek, speed, loop, yoyo) to drive
  `scene.renderFrame()`.
- `cubicBezier(x1, y1, x2, y2)` and `steps(count)` easings.
- **`Transform` class** (`@nmmty/lazycanvas`): `translate`, `rotate`, `scale` (a number or `{ x, y }`), `skew`,
  `origin` and `matrix`, where every number can be a signal. `origin` (`"center"`, `"top-left"`, …,
  or `{ x, y }` in pixels or percent) is the pivot of `rotate`, `scale` and `skew`. `with()`, `lerp()`,
  `toMatrix(box)`, `clone()`. A `Signal<Transform>` animates with `to()`, `spring()` and `keyframes()`.
  `setSkew`, `setOrigin` and `setTransform` on layers. Without an `origin` or `skew` a transform works exactly
  as before.
- **`Matrix` and `Vector2`**: 2D affine math (`multiply`, `apply`, `inverse`, `decompose`, `compose`, `lerp`;
  arithmetic, polar form, rotation). Signals holding them (and `Transform`) are blended as that type.
- **Where a layer is**: after a frame is drawn, `layer.worldMatrix()`, `bounds()`, `worldCorners()`,
  `worldBounds()`, `localToWorld()`, `worldToLocal()`, `contains(point)`, `isDrawn()`; and
  `scene.layerAt(point)` / `scene.layersAt(point)` for the layers under a point.
- **`stagger(options, animations)`** and `stagger(options, items, animate)`: staggered starts with `each` or
  `total`, `from` (`start`, `end`, `center`, `edges`, `random`, an index), `ease` and a `seed`.
  `staggerDelays()` gives the delays.

### Changed
- **Drawing allocates a quarter of what it did** (`@nmmty/lazycanvas`): every `draw` was an `async` function, and
  a frame draws thousands of layers, so the promise and state object of each call were most of what a frame
  allocated. `Morph`, `Text`, `Line`, `Polygon`, `Bezier`, `Quadratic`, `Path2D` and `Group` now draw straight
  through and only a layer that has to wait (an image, a pattern) returns a promise, after which the rest of the
  tree continues in the same order; a layer that throws still does not stop its siblings. Besides that: no
  allocation for a position or size that is a plain number, one reused render record per layer instead of one per
  draw, signal bindings split once instead of per frame, no generator in the per-frame state update, and
  `Group` no longer sets the blend mode or the shadow again when nothing changed. Allocation per frame (sampling
  profiler, fake canvas) went from 5.6 to 1.3 MB on the complex scene and from 0.52 to 0.12 MB on the medium one;
  frame time −17% (12.7 → 10.6 ms) and −5% (1.53 → 1.45 ms), and with a flex layout −34% (3.8 → 2.5 ms). The pixels
  are the same: `node scripts/bench/parity.mjs --against <checkout>` renders every layer type, signals and a
  throwing layer in two builds and compares hashes of the frames. `Layer.draw` may now return `void` instead of a
  promise; callers that `await` it are unaffected.
- **The layout pass is skipped while nothing it depends on has changed** (`@nmmty/lazycanvas`): it used to build
  a tree for the flex engine, run it and copy the result back on every frame, and now the last answer is reused
  while the layers in the flow, their `layout` rules (compared by value), the measured size of their text and the
  canvas size are the same, no layer was added or removed, and nothing has written over what the last pass wrote.
  Otherwise a full pass runs, as before, so the result is the same. A 300-box flex layout went from 4.0 to 2.2 ms
  per frame (−44%) and a flex layout with text and 100 animated layers on top from 6.5 to 3.7 ms (−43%); scenes
  without a layout are unaffected. `manager.layout.stats` counts passes and skips, `manager.layout.reuse = false`
  turns it off.
- **Drawing makes about a third fewer calls into the canvas** (`@nmmty/lazycanvas`): a rounded rectangle is one
  `roundRect` call instead of `moveTo` and four `arcTo` (the old way is kept for radii that do not fit and for
  contexts without `roundRect`), `globalCompositeOperation` is set only when it changes, `shadowColor` is reset only
  after a layer that had a shadow, and the layout pass copies plain data instead of calling `structuredClone` for
  every layer on every frame. On the complex benchmark scene canvas calls per frame went from 15.6k to 10.2k, and
  frame time (median of 5 rounds) from 17.3 to 15.1 ms (−13%); a medium scene −16%, a 300-box flex layout −26%.
- **Exporting an animation takes a fraction of the memory and time** (`@nmmty/lazycanvas`): the APNG
  exporter compresses every frame as it is drawn instead of keeping all the raw frames, `APNGEncoder` copies
  a scanline at a time instead of a byte at a time, and the loops that render a range of frames give the event
  loop a turn between frames. A 20 s, 1280 × 720, 30 fps APNG went from 30.5 s and 4.7 GB to 8.1 s and 229 MB
  (the file is identical byte for byte). `renderAnimation` and `renderAnimationData` still keep every frame
  until they return, and say so; the number of frames of a range no longer depends on floating point drift.

- **`@napi-rs/canvas` 1.2.0 or newer** (`@nmmty/adapter-node`, `@nmmty/adapter-react`): with 1.0.0 every call
  into the canvas leaked about a hundred bytes of native memory that was never given back, so a process that
  kept rendering grew without end (about 30 KB per frame for a scene of sixty rectangles, 1.2 GB after ten minutes
  of an animated scene, with a flat JavaScript heap). 1.2.0 holds steady (164 MB after the same ten minutes). Glyph
  widths of the bundled fonts differ a little between the two versions (a 20 px line of Geist is 141 px wide
  instead of 127), so text layouts can shift.
- `spring(signal, target, config)` is now `signal.spring()`: it is exact instead of stepped, takes presets,
  and blends colours and points instead of jumping to the target. `precision` sets `restDelta` and
  `restSpeed`; without it a spring settles at 0.1% of its distance instead of an absolute `0.01`.
- **Type change:** `Transform` is a class now; the old interface of that name is `TransformProps`. A plain
  object such as `{ rotate: 30 }` is still accepted everywhere a transform is (`transform: { rotate: 30 }`), but a
  variable annotated `const t: Transform = { rotate: 30 }` must become `TransformProps`.
- Colour blending clamps each channel, so an overshooting easing or spring cannot produce `rgba(300, …)`.

- **Animations are functions of time, and the scheduler jumps from one due moment to the next.**
  `signal.to()`, `spring()` and `keyframes()` install a description of the value as a function of time on
  the signal and sleep until it ends; `waitFor`, `all`, `any`, `loopFor`, `delay`, `stagger` and `timeline` wake
  exactly when something is due. Nothing is stepped, so a scene with thousands of running tweens costs only the
  moments they start and end, the same animation gives the same values at any frame rate or time, a tween that ends
  hands over to the next one at that very moment (a `loop` used to lose up to a step on every iteration and drift:
  18 units after ten iterations in a test), and a time given to `renderFrame` is no longer rounded down to a grid.
  Generators that do a bare `yield` keep working: they are resumed on a grid of 1/240 s, with the time that passed.
  Measured against the stepped engine (median of 5 rounds): the engine alone for 1000 looping tweens went from 0.49 to
  0.06 ms per frame at 60 fps and for 5000 from 3.5 to 0.34 ms; playing 20 s of 1000 signals from about 1.6 s to 81 ms;
  running 60 s ahead in one go from 4.7 s to 0.17 s; the complex benchmark scene from 16.7 to 12.3 ms per frame
  (−26%). The history of 1000 moving signals over a minute takes 22 MB.
- When an animation is stopped (`clearAnimations()`, `remove()`, the losing side of an `any()`, the end of a
  `loopFor()`) the signals it was animating stay where they were. If two animations drive one signal, the one that
  started last takes over and the other ending does not undo it.
- `resetTimeline()` stops the running animations as well as setting the time back to 0 (it is used after
  `clearAnimations()` in any case).
- `calculateDuration()` and `scene.duration` run the animation to its end and give its exact length; the
  `timestep` of `calculateDuration` is only the grid for generators that poll.
- An animation added with `addAnimation`/`playAnimation` starts at the time of the last rendered frame.
- `scene.addAnimation` throws if the timeline was moved back while other animations are still running;
  call `clearAnimations()` and `resetTimeline()` first.

### Fixed

- A `Polygon` ignored its `transform`; it is applied now.
- A `Group`'s `transform` was ignored; it now moves everything in the group.
- `Timeline.after()` did not wait for the previous animation; it now starts when it finishes, and
  `seek(time)` pins the next `after()` to a time. Animations started by `at()` no longer run one step ahead.
- A `transform.matrix` with a `0` component (no skew, no offset) was rejected as invalid.
- A tween that should end at exactly its duration could be one step short of it because of rounding.

## [1.2.0]

`@nmmty/lazycanvas` and `@nmmty/adapter-react`.

### Changed

- **Breaking: layer classes lost the `Layer` suffix** (`@nmmty/lazycanvas`): `MorphLayer`, `TextLayer`,
  `ImageLayer`, `LineLayer`, `BezierLayer`, `QuadraticLayer`, `PolygonLayer` and `Path2DLayer` are now
  `Morph`, `Text`, `Image`, `Line`, `Bezier`, `Quadratic`, `Polygon` and `Path2D`, with `IMorphProps`,
  `IMorph`, … instead of `IMorphLayerProps`, `IMorphLayer`, …. They match the components of
  `@nmmty/adapter-react` (and `Group`, which never had the suffix), so a layer tree moves between the core
  JSX and React by changing only the import. `Image` and `Path2D` shadow the browser globals of the same
  name in a module that imports them; import under another name (`import { Image as ImageLayer }`) there.
  `BaseLayer` keeps its name.
- **`ref` on layer components** (`@nmmty/adapter-react`): `<Morph ref={r} />` now hands the layer
  instance to the ref, as the JSX runtime of `@nmmty/lazycanvas` does. It was dropped before.
  `createLayerComponent` and `registerLayer` return a component whose `ref` is typed as the layer class.
- **Types under the component names** (`@nmmty/adapter-react`): `Morph`, `Text`, `Image`, `Line`,
  `Bezier`, `Quadratic`, `Polygon`, `Path2D` and `Group` are also types (`useRef<Morph>(null)`), and
  `IMorphProps`, `ITextProps`, … `IBaseLayerProps` are re-exported, so a file moves between
  `@nmmty/lazycanvas` and `@nmmty/adapter-react` by changing only its import line.

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

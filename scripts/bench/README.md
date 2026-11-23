# Benchmarks

Measures how long LazyCanvas takes to draw frames and to run animations, and compares a checkout with another
git revision.

```bash
pnpm build                                   # the benchmark loads packages/*/dist
pnpm bench                                   # this checkout, 3 rounds
pnpm bench --baseline main --rounds 5        # ...against another ref (made in a temporary worktree)
pnpm bench --only complex,layout             # some scenarios
pnpm bench --no-animations                   # draw only: isolates the cost of the render path
pnpm bench --json bench.json                 # keep every raw result
```

`--baseline <ref>` checks the ref out in a temporary directory, installs and builds it, and removes it afterwards.
Scenarios that use API the baseline does not have (springs, `Transform` origins, history) run on the current
checkout only.

## How it measures

- **One process per scenario** (`run-scenario.mjs`), started with `--expose-gc`, so no scenario inherits another's
  JIT state or heap.
- **Rounds alternate between the builds** (baseline, current, baseline, …) so that the machine slowing down or
  speeding up affects both alike; the report gives the **median over the rounds** and the **spread** between them
  (`(max − min) / median`). On a shared machine the spread is easily 20–40%: a difference smaller than it is not a
  result, run more rounds (`--rounds 8`) or compare with `--no-animations`.
- A frame is `await scene.renderFrame(t)` at 60 fps frame times, timed with `process.hrtime`, after 10 warm-up
  frames. It includes layout, animation stepping and drawing, not encoding.

## Scenarios

| Group | Scenario | What it is |
|---|---|---|
| render | `simple` | 800×450, 5 layers, text, one shadow, one animated box |
| render | `medium`, `medium-cache` | 1280×720, 109 layers, 72 signals; the second with the layer cache on |
| render | `complex` | 1920×1080, 1141 layers, 1800 signals in 600 looping animations, blur, shadows, rotations |
| render | `layout` | 300 flex-wrapped boxes through Yoga, no animation |
| render | `xform-none`, `xform-legacy`, `xform-origin` | 300 layers with an animated rotation: no transform, one without `origin`, one with `origin` and `scale` |
| engine | `engine-N-plain` | N looping tweens stepped by `ThreadScheduler` for 10 s, no canvas |
| engine | `engine-1000-watched`, `-nohistory`, `-step60` | the same with the history recording, without it, and with `step: 1/60` |
| memory | `memory-1000-watched`, `-nohistory` | 1000 moving signals for 60 s: heap growth and the worst frame |
| seek | `seek-*` | going back, scrubbing, returning to the live edge and simulating far ahead |
| extras | `extras` | `scene.layerAt`, matrix maths, `stagger` and springs |

Environment variables for `run-scenario.mjs`: `BENCH_OPTS` (JSON merged into the `Scene` options, for example
`{"history":false,"timeStep":0.016666}`), `BENCH_NOANIM=1`, `BENCH_NOROT=1`, and `LAZYCANVAS_ROOT` (the checkout to
load the library from).

Adding a scenario: build it in `run-scenario.mjs` (`build(name)`), add its name to `SCENARIOS` in `bench.mjs`, and set
`both: true` only if it uses nothing that is missing from the revisions you compare with.

## Showcase scenes: rendering to video

`showcase.mjs` plays two longer scenes, writes them to video and reports how long every frame took. They are
rebuilt on LazyCanvas from the scenes of the project "Could This Asset Be Code" in
[motion-canvas/examples](https://github.com/motion-canvas/examples) (MIT), made for the video
[Could This Asset Be Code?](https://youtu.be/s1ZQnS_tOg0) by aarthificial:

| Scene | What it shows | What it uses |
|---|---|---|
| `memory` | A game file is cut into 63 pieces and loaded into 8 slots of memory; random pieces are thrown out to make room | 79 layers, 207 signals, tweens, colour blending, a typewriter string interpolator |
| `state-machine` | A YAML file describes three states that become cards joined by arrows; a transition is played through them | `timeline()` with positions and labels, `stagger`, `Transform` with signals and `origin`, dashed strokes, `loopFor` |

```bash
pnpm build
node --expose-gc scripts/bench/showcase.mjs                  # both scenes: 1280 px, 60 fps, into bench-out/
node --expose-gc scripts/bench/showcase.mjs memory --width 1920 --fps 30
node --expose-gc scripts/bench/showcase.mjs --no-video       # only the numbers (no ffmpeg needed)
node --expose-gc scripts/bench/showcase.mjs --history false  # without the history that lets time go backwards
```

For each scene it writes `<scene>.mp4` (needs `ffmpeg`), `<scene>-sheet.png` (twelve frames),
`<scene>-frames.png` (the time every frame took) and `stats.json`. After the last frame it moves the timeline to
random frames in random order and checks that they come out pixel-identical to the first pass.

The scenes live in `scripts/bench/showcase/` and take the library as an argument (`build(lib, adapter, options)`),
so they also serve as benchmark scenes. Rendering to video runs `ffmpeg` on the same machine, which takes CPU from
the render: with `--no-video` the frames are about 25% faster.

Not reproduced: the shaders, the 3D parts and the sprite sheet of the original. The character of the state machine
is a small shape that idles, walks or falls, and the code panel is plain text.

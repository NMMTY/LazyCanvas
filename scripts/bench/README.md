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

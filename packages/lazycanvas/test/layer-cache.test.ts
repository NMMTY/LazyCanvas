import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Group, Link, MorphLayer, Path2DLayer, Scene, TextLayer } from "@nmmty/lazycanvas";
import { describe, expect, it, vi } from "vitest";

const adapter = new NodeCanvasAdapter();
const BLOB = "M10 10H70V50H10Z";

const blob = (props: Record<string, unknown> = {}) =>
  new Path2DLayer({
    path2D: BLOB,
    color: "#ff0000",
    filter: "blur(6px)",
    ...props,
  } as never);

const bg = () => new MorphLayer({ color: "#101030", size: { width: 80, height: 60 } });

/** A scene with two root layers, built anew for every frame like a React tree is. */
const frame = (blobProps: Record<string, unknown> = {}) => [bg(), blob(blobProps)];

async function draw(scene: Scene, roots: unknown[]) {
  await scene.renderLatest(0, roots as never);
  return Array.from(scene.getImageData());
}

const plain = () => new Scene(80, 60, { adapter });
const cached = (opts: object | boolean = true) =>
  new Scene(80, 60, { adapter, cache: opts as never });

function maxDiff(a: number[], b: number[]) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe("LayerCache", () => {
  it("is off unless asked for", async () => {
    const scene = plain();
    await draw(scene, frame());
    expect(scene.cacheStats()).toBeUndefined();
  });

  it("copies a layer that has not changed instead of drawing it again", async () => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();

    const first = await draw(scene, frame());
    expect(draws).toHaveBeenCalledTimes(1);
    expect(scene.cacheStats()).toMatchObject({ misses: 1, hits: 0 });

    // A different object with the same values: found again by what it looks like.
    const second = await draw(scene, frame());
    expect(draws).toHaveBeenCalledTimes(1);
    expect(scene.cacheStats()).toMatchObject({ misses: 1, hits: 1 });
    expect(second).toEqual(first);
    draws.mockRestore();
  });

  it("draws the same pixels as a scene without a cache", async () => {
    const expected = await draw(plain(), frame());
    const scene = cached();
    expect(maxDiff(await draw(scene, frame()), expected)).toBeLessThanOrEqual(1);
    expect(maxDiff(await draw(scene, frame()), expected)).toBeLessThanOrEqual(1);
  });

  it("only repaints the stored shape when just the colour changed", async () => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();
    await draw(scene, frame({ color: "#ff0000" }));
    const green = await draw(scene, frame({ color: "#00ff00" }));
    const blue = await draw(scene, frame({ color: "#0000ff" }));
    expect(scene.cacheStats()).toMatchObject({ misses: 1, tinted: 2 });

    // The last colour is kept as a picture, so drawing it again is a plain copy ...
    await draw(scene, frame({ color: "#0000ff" }));
    expect(scene.cacheStats()?.hits).toBe(1);
    // ... and an older one is repainted from the mask, which is still no blur.
    await draw(scene, frame({ color: "#00ff00" }));
    expect(scene.cacheStats()).toMatchObject({ hits: 1, tinted: 3, misses: 1 });
    expect(draws).toHaveBeenCalledTimes(1); // the blur was computed once, for the first frame
    draws.mockRestore();

    // What it painted is what drawing it for real paints.
    expect(maxDiff(green, await draw(plain(), frame({ color: "#00ff00" })))).toBeLessThanOrEqual(2);
    expect(maxDiff(blue, await draw(plain(), frame({ color: "#0000ff" })))).toBeLessThanOrEqual(2);
  });

  it("keeps the alpha of a translucent colour", async () => {
    const scene = cached();
    await draw(scene, frame({ color: "#ff0000" }));
    const got = await draw(scene, frame({ color: "rgba(0, 255, 0, 0.5)" }));
    const want = await draw(plain(), frame({ color: "rgba(0, 255, 0, 0.5)" }));
    expect(maxDiff(got, want)).toBeLessThanOrEqual(2);
  });

  it.each([
    ["the blur radius", { filter: "blur(9px)" }],
    ["the shape", { path2D: "M10 10H60V40H10Z" }],
    ["the opacity", { opacity: 0.5 }],
    ["the stroke", { stroke: { width: 3 } }],
  ])("draws the layer again when %s changes", async (_name, change) => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();
    await draw(scene, frame());
    await draw(scene, frame(change));
    expect(draws).toHaveBeenCalledTimes(2);
    expect(scene.cacheStats()?.hits).toBe(0);
    draws.mockRestore();
  });

  it("does not take a layer at another place for the same picture", async () => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();
    // The inner group is moved by the layout, so the blob is drawn with a translated context.
    const at = (x: number) => [
      bg(),
      new Group({ layout: { width: 80, height: 60 } }).add(
        new Group({ layout: { width: 60, height: 60, margin: [0, 0, 0, x] } }).add(blob()),
      ),
    ];
    await draw(scene, at(0));
    await draw(scene, at(15));
    expect(draws).toHaveBeenCalledTimes(2);
    expect(maxDiff(await draw(scene, at(15)), await draw(plain(), at(15)))).toBeLessThanOrEqual(1);
    expect(scene.cacheStats()?.hits).toBe(1);
    draws.mockRestore();
  });

  it("blends a stored layer in its own mode, over what is underneath", async () => {
    const roots = (color: string) => [bg(), blob({ color, globalComposite: "source-atop" })];
    const scene = cached();
    await draw(scene, roots("#ff0000"));
    const got = await draw(scene, roots("#ff0000"));
    expect(maxDiff(got, await draw(plain(), roots("#ff0000")))).toBeLessThanOrEqual(1);
    expect(scene.cacheStats()?.hits).toBe(1);
  });

  it("stores a layer without a filter only when asked to", async () => {
    const scene = cached();
    const roots = (cache?: boolean) => [
      new MorphLayer({ color: "#00ff00", size: { width: 40, height: 40 }, cache }),
    ];
    await draw(scene, roots());
    expect(scene.cacheStats()).toMatchObject({ misses: 0, bypassed: 0 });

    await draw(scene, roots(true));
    await draw(scene, roots(true));
    expect(scene.cacheStats()).toMatchObject({ misses: 1, hits: 1 });
  });

  it("never stores a layer that opts out", async () => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();
    await draw(scene, frame({ cache: false }));
    await draw(scene, frame({ cache: false }));
    expect(draws).toHaveBeenCalledTimes(2);
    expect(scene.cacheStats()).toMatchObject({ hits: 0, misses: 0 });
    draws.mockRestore();
  });

  it("leaves alone a layer whose look it cannot describe", async () => {
    const scene = cached();
    const odd = (extra: unknown) => {
      const layer = blob();
      (layer.props as Record<string, unknown>).extra = extra;
      return layer;
    };
    // A function, a link to another layer and a buffer have no stable description.
    for (const extra of [() => 1, new Link(), Buffer.from("x")]) {
      await draw(scene, [bg(), odd(extra)]);
    }
    // Each of the three odd layers asked to be stored and could not be; the background never asked.
    expect(scene.cacheStats()).toMatchObject({ hits: 0, misses: 0, bypassed: 3 });
  });

  it("stores a whole group when asked to, and draws it again when a child changes", async () => {
    const draws = vi.spyOn(MorphLayer.prototype, "draw");
    const scene = cached();
    const group = (color: string) =>
      new Group({ cache: true }).add(
        new MorphLayer({ color, size: { width: 20, height: 20 } }),
        new MorphLayer({ color: "#ffffff", size: { width: 10, height: 10 } }),
      );

    await draw(scene, [group("#ff0000")]);
    expect(draws).toHaveBeenCalledTimes(2);
    await draw(scene, [group("#ff0000")]);
    expect(draws).toHaveBeenCalledTimes(2);
    expect(scene.cacheStats()?.hits).toBe(1);

    await draw(scene, [group("#0000ff")]);
    expect(draws).toHaveBeenCalledTimes(4);
    draws.mockRestore();
  });

  it("does not store a text layer unless asked to", async () => {
    const scene = cached();
    const text = () =>
      new TextLayer({
        text: "hi",
        color: "#fff",
        font: { family: "sans-serif", size: 20, weight: 400 },
        filter: "blur(1px)",
      } as never);
    await draw(scene, [text()]);
    await draw(scene, [text()]);
    // Text has a filter here, so it is stored, but it is not tinted (its colour may differ from its shadow).
    expect(scene.cacheStats()).toMatchObject({ misses: 1, hits: 1, tinted: 0 });
  });

  it("keeps one repainted picture per shape, so dragging a colour does not fill the cache", async () => {
    const scene = cached();
    for (const color of ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"]) {
      await draw(scene, frame({ color }));
    }
    // The shape mask and the last repainted picture, nothing else.
    expect(scene.cacheStats()).toMatchObject({ entries: 2, evictions: 0, misses: 1, tinted: 5 });
    expect(scene.cacheStats()?.bytes).toBe(2 * 80 * 60 * 4);
  });

  it("stays inside its limits and drops the least recently used picture", async () => {
    const scene = cached({ maxEntries: 3 });
    for (const blur of [1, 2, 3, 4, 5])
      await draw(scene, frame({ filter: `blur(${blur}px)`, color: "#ff0000" }));
    const stats = scene.cacheStats();
    expect(stats?.entries).toBeLessThanOrEqual(3);
    expect(stats?.evictions).toBeGreaterThan(0);
    expect(stats?.bytes).toBeLessThanOrEqual(3 * 80 * 60 * 4);
  });

  it("forgets everything on clearCache and when the canvas is resized", async () => {
    const draws = vi.spyOn(Path2DLayer.prototype, "draw");
    const scene = cached();
    await draw(scene, frame());
    scene.clearCache();
    expect(scene.cacheStats()).toMatchObject({ entries: 0, bytes: 0 });
    await draw(scene, frame());
    expect(draws).toHaveBeenCalledTimes(2);
    draws.mockRestore();
  });
});

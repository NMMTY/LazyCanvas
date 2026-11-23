import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Easing, Group, Morph, Scene, Text, createSignal } from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

const box = (color: string, x: number, y: number, w = 60, h = 40, extra: object = {}) =>
  new Morph({
    color,
    size: { width: w, height: h, radius: { all: 8 } },
    position: { x, y },
    centring: "none",
    ...extra,
  });

/** The same scene twice: a template with something moving in the middle of it, and static layers on both sides. */
function build(opts: object | undefined) {
  const x = createSignal(10);
  const scene = new Scene(200, 120, { adapter, ...(opts ? { bake: opts } : {}) });
  scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
  const layers = {
    below: [
      box("#0f172a", 0, 0, 200, 120),
      box("#334155", 10, 10, 90, 60, {
        shadow: { color: "#000000aa", blur: 8, offsetX: 2, offsetY: 4 },
      }),
      box("#22c55e88", 50, 30, 80, 50),
      new Text({
        text: "template",
        color: "#ffffff",
        font: { family: "Geist", size: 16, weight: 600 },
        position: { x: 14, y: 14 },
        centring: "none",
        align: "left",
      }),
    ],
    mover: box("#ef4444", x as unknown as number, 80, 30, 30),
    above: [box("#3b82f6aa", 120, 20, 60, 60), box("#eab308", 150, 90, 30, 20)],
  };
  scene.load(new Group({}).add(...layers.below, layers.mover, ...layers.above));
  scene.addAnimation(() => x.to(160, 2, { easing: Easing.linear }));
  return { scene, layers };
}

const ALWAYS = { always: true };
const frames = [0, 0.1, 0.2, 0.3, 0.4, 0.8, 1.2, 1.6, 0.3, 2.2];

function maxDifference(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

describe("baking layers that stay the same", () => {
  it("shows what drawing them would show, before, around and after the layer that moves", async () => {
    const plain = build(undefined);
    const baked = build(ALWAYS);
    for (const t of frames) {
      await plain.scene.renderFrame(t);
      await baked.scene.renderFrame(t);
      // Translucent layers are blended with each other first and with what is below later, which can differ
      // by a rounding step.
      expect(
        maxDifference(plain.scene.getImageData(), baked.scene.getImageData()),
      ).toBeLessThanOrEqual(2);
    }
    const stats = baked.scene.bakeStats();
    // Two runs, the layers under the moving one and the ones over it.
    expect(stats?.bakes).toBe(2);
    expect(stats?.blits).toBeGreaterThan(0);
  });

  it("is off unless asked for", async () => {
    const { scene } = build(undefined);
    await scene.renderFrame(0);
    expect(scene.bakeStats()).toBeUndefined();
  });

  it("notices a layer that is changed in place", async () => {
    const plain = build(undefined);
    const baked = build(ALWAYS);
    for (const t of [0, 0.1, 0.2, 0.3]) {
      await plain.scene.renderFrame(t);
      await baked.scene.renderFrame(t);
    }
    expect(baked.scene.bakeStats()?.blits).toBeGreaterThan(0);

    for (const { layers } of [plain, baked]) {
      (layers.below[1].props as { color: string }).color = "#ff00ff";
      layers.above[1].visible = false;
    }
    await plain.scene.renderFrame(0.4);
    await baked.scene.renderFrame(0.4);
    expect(
      maxDifference(plain.scene.getImageData(), baked.scene.getImageData()),
    ).toBeLessThanOrEqual(2);
    const data = baked.scene.getImageData();
    const at = (px: number, py: number) =>
      Array.from(data.slice((py * 200 + px) * 4, (py * 200 + px) * 4 + 3));
    expect(at(20, 20)).toEqual([255, 0, 255]);
    expect(at(160, 100)).not.toEqual([234, 179, 8]);
  });

  it("leaves layers with a blend mode of their own and layers that opt out to be drawn", async () => {
    const make = (opts: object | undefined) => {
      const scene = new Scene(100, 60, { adapter, ...(opts ? { bake: opts } : {}) });
      scene.load(
        new Group({}).add(
          box("#808080", 0, 0, 100, 60),
          box("#ff0000", 10, 10, 50, 30, { globalComposite: "difference" }),
          box("#00ff00", 40, 20, 50, 30, { bake: false }),
        ),
      );
      return scene;
    };
    const plain = make(undefined);
    const baked = make(ALWAYS);
    for (const t of [0, 0.1, 0.2, 0.3]) {
      await plain.renderFrame(t);
      await baked.renderFrame(t);
    }
    expect(Array.from(baked.getImageData())).toEqual(Array.from(plain.getImageData()));
    // The first layer is the only one that can be baked.
    expect(baked.bakeStats()?.bakes).toBe(1);
  });

  it("forgets its pictures when a font is added", async () => {
    const { scene } = build(ALWAYS);
    for (const t of [0, 0.1, 0.2, 0.3]) await scene.renderFrame(t);
    expect(scene.bakeStats()?.entries).toBeGreaterThan(0);
    scene.lazyCanvas.manager.fonts.add({
      family: "Another",
      weight: "400",
      base64: Fonts.Geist["400"],
    } as never);
    expect(scene.bakeStats()?.entries).toBe(0);
  });

  it("still draws the others, then reports, when a layer in a run throws", async () => {
    const scene = new Scene(100, 60, { adapter, bake: ALWAYS });
    const bad = box("#ff0000", 0, 0, 10, 10);
    bad.draw = () => {
      throw new Error("boom");
    };
    scene.load(
      new Group({}).add(box("#00ff00", 0, 0, 100, 60), bad, box("#0000ff", 50, 0, 50, 60)),
    );
    for (const t of [0, 0.1, 0.2, 0.3]) {
      await expect(scene.renderFrame(t)).rejects.toThrow("boom");
      const data = scene.getImageData();
      expect(Array.from(data.slice((30 * 100 + 20) * 4, (30 * 100 + 20) * 4 + 3))).toEqual([
        0, 255, 0,
      ]);
      expect(Array.from(data.slice((30 * 100 + 75) * 4, (30 * 100 + 75) * 4 + 3))).toEqual([
        0, 0, 255,
      ]);
    }
  });

  it("does not bake a run that is cheaper to draw than to copy", async () => {
    const scene = new Scene(100, 60, { adapter, bake: true });
    scene.load(new Group({}).add(box("#00ff00", 0, 0, 20, 20), box("#0000ff", 30, 0, 20, 20)));
    for (const t of [0, 0.1, 0.2, 0.3, 0.4]) await scene.renderFrame(t);
    const stats = scene.bakeStats();
    expect(stats?.bakes).toBe(0);
    expect(stats?.blits).toBe(0);
  });

  it("is cleared with the cache", async () => {
    const { scene } = build(ALWAYS);
    for (const t of [0, 0.1, 0.2, 0.3]) await scene.renderFrame(t);
    scene.clearCache();
    expect(scene.bakeStats()?.bytes).toBe(0);
  });
});

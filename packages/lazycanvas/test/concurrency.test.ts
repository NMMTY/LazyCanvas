import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import {
  Centring,
  Div,
  ImageLayer,
  MorphLayer,
  Scene,
  TextLayer,
  collectFontSpecs,
} from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

/** A 64x64 red PNG, used as an image source without touching the filesystem. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAPElEQVR42u3OMQEAAAgDoJnc6BpjDyQgN3PVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgLbGkAAeqgHiEAAAAASUVORK5CYII=",
  "base64",
);

/**
 * Adapter whose image loading takes a while, like a cold HTTP fetch, and which
 * reports how deeply save/restore is nested on the context.
 */
function makeAdapter(delayMs: number, probe: { depth: number; peak: number }) {
  const base = new NodeCanvasAdapter();
  return {
    fonts: base.fonts,
    Path2D: base.Path2D,
    createCanvas(w: number, h: number) {
      const canvas = base.createCanvas(w, h) as any;
      const realGetContext = canvas.getContext.bind(canvas);
      canvas.getContext = (id: "2d") => {
        const ctx = realGetContext(id);
        if (ctx.__probed) return ctx;
        const save = ctx.save.bind(ctx);
        const restore = ctx.restore.bind(ctx);
        ctx.save = () => {
          probe.depth++;
          probe.peak = Math.max(probe.peak, probe.depth);
          save();
        };
        ctx.restore = () => {
          probe.depth--;
          restore();
        };
        ctx.__probed = true;
        return ctx;
      };
      return canvas;
    },
    loadImage: async () => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return base.loadImage(PNG);
    },
  } as any;
}

const tree = () =>
  new Div({ layout: { flexDirection: "row", alignItems: "center", padding: 20 } }).add(
    new MorphLayer({ color: "#1e293b", layout: { width: 120, height: 80 } }, { id: "bg" }),
    new ImageLayer(
      {
        src: "memory",
        size: { width: 64, height: 64, radius: { all: 32 } },
        layout: { width: 64, height: 64 },
      },
      { id: "avatar" },
    ),
  );

describe("Scene.renderFrame serialization", () => {
  it("does not interleave two frames on the same context", async () => {
    // Layers hold ctx.save() across awaits, so overlapping frames used to nest
    // their save/restore pairs and pop each other's state — which is how a
    // clipped, rounded avatar ended up drawn as an unclipped square.
    const probe = { depth: 0, peak: 0 };
    const scene = new Scene(300, 120, { adapter: makeAdapter(10, probe) });
    scene.load(tree());

    await Promise.all([scene.renderFrame(0), scene.renderFrame(0)]);

    const concurrentPeak = probe.peak;

    const seqProbe = { depth: 0, peak: 0 };
    const seqScene = new Scene(300, 120, { adapter: makeAdapter(10, seqProbe) });
    seqScene.load(tree());
    await seqScene.renderFrame(0);
    await seqScene.renderFrame(0);

    expect(concurrentPeak).toBe(seqProbe.peak);
    expect(probe.depth).toBe(0);
  });

  it("runs queued frames one after another, in order", async () => {
    const scene = new Scene(200, 80, { adapter: makeAdapter(5, { depth: 0, peak: 0 }) });
    scene.load(tree());

    let active = 0;
    let overlaps = 0;
    const order: number[] = [];

    const pipeline = scene.lazyCanvas.manager.render as any;
    const realRender = pipeline.render.bind(pipeline);
    pipeline.render = async (format: any) => {
      active++;
      if (active > 1) overlaps++;
      try {
        return await realRender(format);
      } finally {
        active--;
      }
    };

    await Promise.all([0, 1, 2, 3].map((i) => scene.renderFrame(i / 60).then(() => order.push(i))));

    expect(overlaps).toBe(0);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("keeps rendering after a frame throws", async () => {
    const scene = new Scene(100, 100, { adapter: makeAdapter(0, { depth: 0, peak: 0 }) });

    // No layers loaded yet: the first frame rejects.
    await expect(scene.renderFrame(0)).rejects.toThrow(/No root layer/i);

    scene.load(tree());
    await expect(scene.renderFrame(0)).resolves.toBeUndefined();
  });

  it("still produces the expected pixels when frames overlap", async () => {
    const hash = (d: Uint8ClampedArray) => {
      let h = 0;
      for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0;
      return h;
    };

    const clean = new Scene(300, 120, { adapter: makeAdapter(0, { depth: 0, peak: 0 }) });
    clean.load(tree());
    await clean.renderFrame(0);
    const expected = hash(clean.getImageData());

    const raced = new Scene(300, 120, { adapter: makeAdapter(8, { depth: 0, peak: 0 }) });
    raced.load(tree());
    await Promise.all([raced.renderFrame(0), raced.renderFrame(0), raced.renderFrame(0)]);

    expect(hash(raced.getImageData())).toBe(expected);
  });
});

describe("collectFontSpecs", () => {
  const adapter = new NodeCanvasAdapter();

  it("finds every font used in a tree, deduplicated", () => {
    const scene = new Scene(200, 200, { adapter });
    scene.load(
      new Div().add(
        new TextLayer({
          text: "a",
          color: "#fff",
          font: { family: "Geist Mono", size: 36, weight: 400 },
          centring: Centring.None,
        }),
        new Div().add(
          new TextLayer({
            text: "b",
            color: "#fff",
            font: { family: "Geist Mono", size: 36, weight: 400 },
            centring: Centring.None,
          }),
          new TextLayer({
            text: "c",
            color: "#fff",
            font: { family: "Geist", size: 14, weight: 700 },
            centring: Centring.None,
          }),
        ),
      ),
    );

    const specs = collectFontSpecs(scene.lazyCanvas.manager.layers.toArray()).sort();
    expect(specs).toEqual(['400 36px "Geist Mono", sans-serif', '700 14px "Geist", sans-serif']);
  });

  it("ignores layers without a font", () => {
    const root = new Div().add(
      new MorphLayer({ color: "#fff", size: { width: 1, height: 1 } }, { id: "m" }),
    );
    expect(collectFontSpecs(root)).toEqual([]);
  });
});

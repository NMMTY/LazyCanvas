import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Centring, Div, Scene, TextLayer } from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

function sceneWith(layer: TextLayer, w = 400, h = 300) {
  const scene = new Scene(w, h, { adapter });
  scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
  scene.load(new Div().add(layer));
  return scene;
}

const text = (props: Record<string, any>) =>
  new TextLayer({
    text: "one two three",
    color: "#ffffff",
    font: { family: "Geist", size: 20, weight: 400 },
    position: { x: 10, y: 10 },
    align: "left",
    baseline: "top",
    centring: Centring.None,
    ...props,
  } as any);

/** Bounding box of every non-transparent pixel. */
function inkBounds(data: Uint8ClampedArray, w: number, h: number) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0
    ? { empty: true, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 }
    : { empty: false, width: maxX - minX + 1, height: maxY - minY + 1, minX, minY, maxX, maxY };
}

describe("TextLayer measurement in vertical directions", () => {
  it("reports a tall narrow box instead of a wide one", () => {
    const horizontal = text({ direction: "ltr" });
    const vertical = text({ direction: "ttb", vertical: { mode: "words" } });

    const scene = sceneWith(horizontal);
    const ctx = scene.lazyCanvas.ctx;
    const canvas = scene.lazyCanvas.canvas;

    const h = horizontal.measureText(ctx, canvas);
    const v = vertical.measureText(ctx, canvas);

    expect(h.width).toBeGreaterThan(h.height);
    expect(v.height).toBeGreaterThan(v.width);
    // Three words, three slots.
    expect(v.height).toBeCloseTo(3 * 20 * 1.1, 5);
  });

  it("measures ideographs as one slot per character", () => {
    const layer = text({ text: "abcd", direction: "ttb", vertical: { mode: "ideographs" } });
    const scene = sceneWith(layer);
    const m = layer.measureText(scene.lazyCanvas.ctx, scene.lazyCanvas.canvas);
    expect(m.height).toBeCloseTo(4 * 20 * 1.1, 5);
  });

  it("wraps into columns only when multiline is enabled", () => {
    const common = {
      text: "abcdefgh",
      direction: "ttb",
      vertical: { mode: "ideographs" },
      size: { width: 0, height: 60 },
    };
    const scene = sceneWith(text(common));
    const ctx = scene.lazyCanvas.ctx;
    const canvas = scene.lazyCanvas.canvas;

    const single = text(common).measureText(ctx, canvas);
    const wrapped = text({ ...common, multiline: { enabled: true, spacing: 1.1 } }).measureText(
      ctx,
      canvas,
    );

    expect(wrapped.height).toBeLessThan(single.height);
    expect(wrapped.width).toBeGreaterThan(single.width);
  });
});

describe("TextLayer rendering in vertical directions", () => {
  it("draws a tall narrow block instead of a wide one", async () => {
    const wide = sceneWith(text({ direction: "ltr" }));
    await wide.renderFrame(0);
    const h = inkBounds(wide.getImageData(), 400, 300);

    const tall = sceneWith(text({ direction: "ttb", vertical: { mode: "words" } }));
    await tall.renderFrame(0);
    const v = inkBounds(tall.getImageData(), 400, 300);

    expect(h.empty).toBe(false);
    expect(v.empty).toBe(false);
    expect(h.width).toBeGreaterThan(h.height);
    expect(v.height).toBeGreaterThan(v.width);
  });

  it("puts the first word at the top for ttb and at the bottom for btt", async () => {
    // "iii" is much narrower than "wwwwww", so the widest row of ink tells us
    // which word landed where without needing to read glyphs.
    const content = { text: "iii wwwwww", vertical: { mode: "words" } };

    const ttb = sceneWith(text({ ...content, direction: "ttb" }));
    await ttb.renderFrame(0);
    const btt = sceneWith(text({ ...content, direction: "btt" }));
    await btt.renderFrame(0);

    const widestRow = (data: Uint8ClampedArray) => {
      let best = { y: -1, count: -1 };
      for (let y = 0; y < 300; y++) {
        let count = 0;
        for (let x = 0; x < 400; x++) if (data[(y * 400 + x) * 4 + 3] > 40) count++;
        if (count > best.count) best = { y, count };
      }
      return best.y;
    };

    // The wide word is second, so ttb draws it low and btt draws it high.
    expect(widestRow(ttb.getImageData())).toBeGreaterThan(widestRow(btt.getImageData()));
  });

  it("renders every column when the text wraps", async () => {
    const one = sceneWith(
      text({
        text: "abcdefghij",
        direction: "ttb",
        vertical: { mode: "ideographs" },
      }),
    );
    await one.renderFrame(0);
    const single = inkBounds(one.getImageData(), 400, 300);

    const many = sceneWith(
      text({
        text: "abcdefghij",
        direction: "ttb",
        vertical: { mode: "ideographs", columns: "lr", gap: 6 },
        multiline: { enabled: true, spacing: 1.1 },
        size: { width: 0, height: 70 },
      }),
    );
    await many.renderFrame(0);
    const wrapped = inkBounds(many.getImageData(), 400, 300);

    expect(wrapped.width).toBeGreaterThan(single.width);
    expect(wrapped.height).toBeLessThan(single.height);
  });

  it("mirrors the column order between rl and lr", async () => {
    const opts = {
      text: "iiiiii w",
      direction: "ttb",
      multiline: { enabled: true, spacing: 1.1 },
      size: { width: 0, height: 70 },
    };
    const render = async (columns: string) => {
      const s = sceneWith(text({ ...opts, vertical: { mode: "ideographs", columns } }));
      await s.renderFrame(0);
      return inkBounds(s.getImageData(), 400, 300);
    };

    const rl = await render("rl");
    const lr = await render("lr");

    expect(rl.empty).toBe(false);
    expect(lr.empty).toBe(false);
    // Same footprint, mirrored content.
    expect(rl.width).toBe(lr.width);
  });

  it("never hands a vertical direction to the canvas context", async () => {
    const scene = sceneWith(text({ direction: "ttb", vertical: { mode: "words" } }));
    await scene.renderFrame(0);
    expect(["ltr", "rtl", "inherit"]).toContain(scene.lazyCanvas.ctx.direction);
  });

  it("still honours ltr and rtl", async () => {
    for (const direction of ["ltr", "rtl"]) {
      const scene = sceneWith(text({ direction }));
      await scene.renderFrame(0);
      expect(inkBounds(scene.getImageData(), 400, 300).empty).toBe(false);
    }
  });
});

describe("vertical text in a flex layout", () => {
  it("is measured as a tall narrow box, so the row lays out around it", async () => {
    const vertical = new TextLayer(
      {
        text: "one two three",
        color: "#ffffff",
        font: { family: "Geist", size: 20, weight: 400 },
        direction: "ttb",
        vertical: { mode: "words" },
      } as any,
      { id: "vtext" },
    );
    const after = new (await import("@nmmty/lazycanvas")).MorphLayer(
      { color: "#ff0000", layout: { width: 30, height: 30 } },
      { id: "after" },
    );

    const scene = new Scene(400, 300, { adapter });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    scene.load(new Div({ layout: { flexDirection: "row" } }, { id: "row" }).add(vertical, after));
    await scene.renderFrame(0);

    // The block is only as wide as its widest word, so the box after it starts
    // well before where a horizontal "one two three" would have ended.
    expect(after.props.position?.x).toBeGreaterThan(0);
    expect(after.props.position?.x).toBeLessThan(80);
  });
});

describe("serialization", () => {
  it("round-trips the vertical options", () => {
    const layer = new TextLayer(
      {
        text: "abc",
        color: "#fff",
        font: { family: "Geist", size: 20, weight: 400 },
        direction: "btt",
        vertical: { mode: "ideographs", columns: "lr", gap: 4 },
      } as any,
      { id: "t" },
    );

    const json = layer.toJSON() as any;
    expect(json.props.direction).toBe("btt");
    expect(json.props.vertical).toEqual({ mode: "ideographs", columns: "lr", gap: 4 });
  });

  it("fills in defaults for a layer that does not configure vertical text", () => {
    const layer = new TextLayer({
      text: "abc",
      color: "#fff",
      font: { family: "Geist", size: 20, weight: 400 },
    } as any);
    expect(layer.props.vertical).toEqual({ mode: "words", columns: "rl", gap: 0 });
  });
});

describe("vertical text under the layout engine", () => {
  it("measures a wrapped column the same way it draws it", async () => {
    // The measure pass used to relax the horizontal constraints — no multiline,
    // no width — which for vertical text meant measuring one very tall column
    // while draw wrapped it into several short ones. The node then got a height
    // the text never actually occupied.
    const layer = new TextLayer(
      {
        text: "abcdefghijkl",
        color: "#ffffff",
        font: { family: "Geist", size: 20, weight: 400 },
        direction: "ttb",
        vertical: { mode: "ideographs", columns: "rl", gap: 4 },
        multiline: { enabled: true, spacing: 1.2 },
        size: { width: 0, height: 100 },
      } as any,
      { id: "wrapped" },
    );

    const scene = new Scene(400, 300, { adapter });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    // flex-start, so the row does not stretch the text to its own height.
    scene.load(
      new Div({ layout: { flexDirection: "row", alignItems: "flex-start" } }, { id: "row" }).add(
        layer,
      ),
    );
    await scene.renderFrame(0);

    // Four slots of 24px fit in 100px, so twelve characters make three columns
    // and the block is 96 tall — not one column of 12 * 24 = 288.
    expect(layer.props.size?.height).toBeCloseTo(96, 0);
    expect(layer.props.size?.width).toBeGreaterThan(30);
  });

  it("wraps to the box the layout gives it when the parent stretches", async () => {
    // A stretching parent overrides the authored height, and that computed box
    // becomes the wrap constraint — the same way horizontal multiline text
    // wraps to its computed width.
    const layer = new TextLayer(
      {
        text: "abcdefghijkl",
        color: "#ffffff",
        font: { family: "Geist", size: 20, weight: 400 },
        direction: "ttb",
        vertical: { mode: "ideographs" },
        multiline: { enabled: true, spacing: 1.2 },
        size: { width: 0, height: 100 },
      } as any,
      { id: "stretched" },
    );

    const scene = new Scene(400, 300, { adapter });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    scene.load(new Div({ layout: { flexDirection: "row" } }, { id: "row" }).add(layer));
    await scene.renderFrame(0);

    expect(layer.props.size?.height).toBeCloseTo(300, 0);
  });
});

import { describe, expect, it } from "vitest";
import {
  Centring,
  ClassicRenderPipeline,
  Div,
  JSONReader,
  LazyCanvas,
  MorphLayer,
  Path2DLayer,
  Scene,
  TextLayer,
} from "@nmmty/lazycanvas";
import { Exporter } from "@nmmty/lazycanvas/node";
import { NodeCanvasAdapter } from "@nmmty/adapter-node";

const adapter = new NodeCanvasAdapter();

/** Counts pixels matching a predicate over the scene's RGBA buffer. */
function countPixels(data: Uint8ClampedArray, match: (r: number, g: number, b: number, a: number) => boolean) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (match(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
  }
  return n;
}

describe("LazyCanvas construction", () => {
  it("fails with an actionable message when no adapter is given", () => {
    // @ts-expect-error deliberately omitting the adapter
    expect(() => new LazyCanvas(ClassicRenderPipeline, {})).toThrow(/adapter is required/i);
  });

  it("creates a canvas of the requested size", () => {
    const canvas = new LazyCanvas(ClassicRenderPipeline, { adapter }).create(120, 80);
    expect(canvas.canvas.width).toBe(120);
    expect(canvas.canvas.height).toBe(80);
  });
});

describe("Scene rendering in Node", () => {
  it("draws a filled shape", async () => {
    const scene = new Scene(100, 100, { adapter });
    scene.load(
      new Div().add(
        new MorphLayer({
          color: "#00ff00",
          size: { width: 50, height: 50 },
          position: { x: 0, y: 0 },
          centring: Centring.None,
        }),
      ),
    );
    await scene.renderFrame(0);

    const green = countPixels(scene.getImageData(), (r, g, b, a) => g > 200 && r < 60 && a > 200);
    expect(green).toBeGreaterThan(2000);
  });

  it("renders Path2DLayer from an SVG path string", async () => {
    const scene = new Scene(200, 200, { adapter });
    scene.load(
      new Div().add(
        new Path2DLayer({ color: "#ff0000", centring: Centring.None }).setPath(
          "M 20 20 L 180 20 L 100 180 Z",
        ),
      ),
    );
    await scene.renderFrame(0);

    const red = countPixels(scene.getImageData(), (r, g, _b, a) => r > 200 && g < 80 && a > 200);
    expect(red).toBeGreaterThan(5000);
  });

  it("renders Path2DLayer built through the imperative API", async () => {
    const scene = new Scene(100, 100, { adapter });
    const layer = new Path2DLayer({ color: "#0000ff", centring: Centring.None });
    layer.rect(10, 10, 50, 50);
    scene.load(new Div().add(layer));
    await scene.renderFrame(0);

    const blue = countPixels(scene.getImageData(), (r, _g, b, a) => b > 200 && r < 80 && a > 200);
    expect(blue).toBe(2500);
  });

  it("finds nested layers through getLayer", async () => {
    const deep = new MorphLayer(
      { color: "#ffffff", size: { width: 5, height: 5 }, centring: Centring.None },
      { id: "deep" },
    );
    const scene = new Scene(50, 50, { adapter });
    scene.load(new Div({}, { id: "outer" }).add(new Div({}, { id: "inner" }).add(deep)));
    expect(scene.getLayer("deep")).toBe(deep);
  });

  it("applies flex layout to children", async () => {
    const a = new MorphLayer({ color: "#111111", layout: { width: 40, height: 40 } }, { id: "a" });
    const b = new MorphLayer({ color: "#222222", layout: { width: 40, height: 40 } }, { id: "b" });
    const scene = new Scene(200, 100, { adapter });
    scene.load(new Div({ layout: { flexDirection: "row", gap: 20 } }, { id: "row" }).add(a, b));
    await scene.renderFrame(0);

    // Yoga lays the two boxes out in a row separated by the gap.
    expect(a.props.position?.x).toBe(0);
    expect(b.props.position?.x).toBe(60);
  });
});

describe("Exporter formats", () => {
  const scene = () => {
    const s = new Scene(60, 40, { adapter });
    s.load(
      new Div().add(
        new MorphLayer({
          color: "#123456",
          size: { width: 60, height: 40 },
          position: { x: 0, y: 0 },
          centring: Centring.None,
        }),
      ),
    );
    return s;
  };

  it("encodes real PNG bytes", async () => {
    const buf: Buffer = await new Exporter(scene()).export("png");
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("encodes real WebP bytes rather than a renamed PNG", async () => {
    const buf: Buffer = await new Exporter(scene()).export("webp");
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("encodes real JPEG bytes", async () => {
    const buf: Buffer = await new Exporter(scene()).export("jpg");
    expect(buf.subarray(0, 2).toString("hex")).toBe("ffd8");
  });

  it("rejects unsupported formats", async () => {
    await expect(new Exporter(scene()).export("svg" as any)).rejects.toThrow(/not supported/i);
  });
});

describe("JSON round-trip", () => {
  it("preserves group props and nested layers", async () => {
    const canvas = new LazyCanvas(ClassicRenderPipeline, { adapter }).create(100, 100);
    const group = new Div(
      { position: { x: 12, y: 34 }, layout: { flexDirection: "row", gap: 8 } },
      { id: "g1" },
    );
    group.add(
      new MorphLayer(
        { color: "#00ff00", size: { width: 10, height: 10 }, centring: Centring.None },
        { id: "m1" },
      ),
    );
    canvas.manager.layers.add(group);

    const json = JSON.parse(await new Exporter(canvas).export("json"));
    const restored = JSONReader.read(json, { adapter });
    const restoredGroup = restored.manager.layers.get("g1") as Div;

    expect(restoredGroup).toBeDefined();
    expect(restoredGroup.props.position).toEqual({ x: 12, y: 34 });
    expect((restoredGroup.props.layout as any).gap).toBe(8);
    expect(restoredGroup.layers.map((l) => l.id)).toEqual(["m1"]);
  });

  it("produces the same pixels after a round-trip", async () => {
    const build = () => {
      const c = new LazyCanvas(ClassicRenderPipeline, { adapter }).create(80, 80);
      c.manager.layers.add(
        new MorphLayer(
          {
            color: "#ff8800",
            size: { width: 40, height: 20, radius: { all: 4 } },
            position: { x: 10, y: 10 },
            centring: Centring.None,
          },
          { id: "box" },
        ),
      );
      return c;
    };

    const original = build();
    const before: Buffer = await original.manager.render.render("png");

    const json = JSON.parse(await new Exporter(build()).export("json"));
    const after: Buffer = await JSONReader.read(json, { adapter }).manager.render.render("png");

    expect(after.equals(before)).toBe(true);
  });
});

describe("Text rendering", () => {
  it("draws visible glyphs with a bundled font", async () => {
    const scene = new Scene(240, 60, { adapter });
    scene.load(
      new Div().add(
        new TextLayer({
          text: "LazyCanvas",
          color: "#ffffff",
          font: { family: "Geist", size: 28, weight: 700 },
          position: { x: 10, y: 40 },
          centring: Centring.None,
        }),
      ),
    );
    await scene.renderFrame(0);

    const lit = countPixels(scene.getImageData(), (_r, _g, _b, a) => a > 128);
    expect(lit).toBeGreaterThan(200);
  });
});

import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Group, ImageLayer, MorphLayer, Scene } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

const BAD = "https://invalid.invalid/does-not-exist.png";

const box = (x: number, color: string) =>
  new MorphLayer({
    color,
    size: { width: 20, height: 20 },
    position: { x, y: 20 },
    centring: "none",
  });

const image = (extra: Record<string, unknown> = {}) =>
  new ImageLayer({
    src: BAD,
    size: { width: 20, height: 20 },
    position: { x: 40, y: 20 },
    centring: "none",
    ...extra,
  } as never);

function pixel(scene: Scene, x: number, y: number): [number, number, number, number] {
  const data = scene.getImageData();
  const i = (y * scene.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

const isRed = (p: number[]) => p[0] > 200 && p[1] < 40 && p[2] < 40 && p[3] > 200;
const isBlue = (p: number[]) => p[2] > 200 && p[0] < 40 && p[1] < 40 && p[3] > 200;

describe("a layer that fails to draw", () => {
  it("does not stop the layers after it from rendering", async () => {
    const scene = new Scene(100, 60, { adapter });
    scene.load(new Group().add(box(10, "#ff0000"), image(), box(70, "#0000ff")));
    await scene.renderFrame(0).catch(() => undefined);

    expect(isRed(pixel(scene, 20, 30))).toBe(true);
    expect(isBlue(pixel(scene, 80, 30))).toBe(true);
  });

  it("leaves the canvas state balanced, so the next frame is not offset or doubled", async () => {
    // Items sized by the layout: the inner group is placed by Yoga at (15, 15), and
    // draws inside a translated context. If a child throws, that translate must
    // still be undone — otherwise the next frame is drawn shifted and clears the
    // wrong area, leaving the previous frame behind as a second, offset copy.
    const sized = (extra: Record<string, unknown>) => ({
      ...extra,
      layout: { width: 20, height: 20 },
    });
    const scene = new Scene(100, 80, { adapter });
    scene.load(
      new Group({ layout: { width: 100, height: 80, padding: 15 } }).add(
        new Group({ layout: { flexDirection: "row" } }).add(
          new MorphLayer(sized({ color: "#ff0000", size: { width: 20, height: 20 } }) as never),
          new ImageLayer(sized({ src: BAD, size: { width: 20, height: 20 } }) as never),
        ),
      ),
    );

    for (let frame = 0; frame < 3; frame++)
      await scene.renderFrame(frame / 60).catch(() => undefined);

    expect(isRed(pixel(scene, 25, 25))).toBe(true);
    // Where a copy shifted by the group's offset would land, there is nothing.
    expect(pixel(scene, 45, 45)[3]).toBe(0);
    expect(pixel(scene, 25, 45)[3]).toBe(0);
  });
});

describe("ImageLayer placeholder", () => {
  it("draws a placeholder where the image should be when it cannot be loaded", async () => {
    const scene = new Scene(100, 60, { adapter });
    scene.load(new Group().add(box(10, "#ff0000"), image(), box(70, "#0000ff")));

    await expect(scene.renderFrame(0)).resolves.toBeUndefined();

    const inside = pixel(scene, 42, 24);
    expect(inside[3]).toBeGreaterThan(200); // something opaque stands in for the image
    expect(isBlue(pixel(scene, 80, 30))).toBe(true);
  });

  it("honours the corner radius for the placeholder", async () => {
    const scene = new Scene(100, 60, { adapter });
    scene.load(new Group().add(image({ size: { width: 20, height: 20, radius: { all: 10 } } })));
    await scene.renderFrame(0);
    expect(pixel(scene, 40, 20)[3]).toBe(0); // clipped corner
    expect(pixel(scene, 50, 30)[3]).toBeGreaterThan(200);
  });

  it("can be turned off, in which case the failure is reported", async () => {
    const scene = new Scene(100, 60, { adapter });
    scene.load(new Group().add(image({ placeholder: false })));
    await expect(scene.renderFrame(0)).rejects.toThrow();
  });

  it("with the placeholder off, still draws the other layers before reporting", async () => {
    const scene = new Scene(100, 60, { adapter });
    scene.load(
      new Group().add(box(10, "#ff0000"), image({ placeholder: false }), box(70, "#0000ff")),
    );

    await expect(scene.renderFrame(0)).rejects.toThrow(/could not be loaded/);
    expect(isRed(pixel(scene, 20, 30))).toBe(true);
    expect(isBlue(pixel(scene, 80, 30))).toBe(true);
  });

  it("still draws the real image when it loads", async () => {
    const tile = adapter.createCanvas(4, 4) as any;
    const c = tile.getContext("2d");
    c.fillStyle = "#00ff00";
    c.fillRect(0, 0, 4, 4);
    const scene = new Scene(100, 60, { adapter });
    scene.load(new Group().add(image({ src: tile.toBuffer("image/png") })));
    await scene.renderFrame(0);
    const p = pixel(scene, 50, 30);
    expect(p[1]).toBeGreaterThan(200);
    expect(p[0]).toBeLessThan(40);
  });
});

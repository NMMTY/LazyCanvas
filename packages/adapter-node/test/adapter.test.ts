import { Fonts } from "@nmmty/lazycanvas/fonts";
import { describe, expect, it } from "vitest";
import { NodeCanvasAdapter } from "../src";

const adapter = new NodeCanvasAdapter();

describe("NodeCanvasAdapter", () => {
  it("creates canvases of the requested size", () => {
    const canvas = adapter.createCanvas(64, 32);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(32);
    expect(canvas.getContext("2d")).toBeTruthy();
  });

  it("loads an image from encoded bytes", async () => {
    const canvas = adapter.createCanvas(8, 4) as any;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 8, 4);
    const png: Buffer = canvas.toBuffer("image/png");

    const image = await adapter.loadImage(png);
    expect(image.width).toBe(8);
    expect(image.height).toBe(4);
  });

  it("rejects an image source that cannot be decoded", async () => {
    await expect(adapter.loadImage(Buffer.from("not an image"))).rejects.toBeTruthy();
  });

  it("exposes a Path2D constructor", () => {
    const path = new adapter.Path2D();
    path.rect(0, 0, 10, 10);
    expect(path).toBeTruthy();
  });

  describe("fonts", () => {
    it("registers a base64 font and reports it", () => {
      const source = Fonts.Geist[400];
      expect(adapter.fonts.has("LazyTestFamily")).toBe(false);
      expect(adapter.fonts.register(source, "LazyTestFamily")).toBe(true);
      expect(adapter.fonts.has("LazyTestFamily")).toBe(true);
      expect(adapter.fonts.families).toContain("LazyTestFamily");
    });

    it("reports a failure instead of throwing for a missing font file", () => {
      expect(adapter.fonts.registerFromPath("/definitely/not/here.ttf", "Nope")).toBe(false);
      expect(adapter.fonts.has("Nope")).toBe(false);
    });
  });
});

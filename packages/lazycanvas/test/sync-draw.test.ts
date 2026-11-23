import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Group, Image, Morph, Scene } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";
import { eachInOrder, isLater, withFill } from "../src/utils";

const adapter = new NodeCanvasAdapter();

describe("drawing without promises", () => {
  it("draws a tree of plain layers without returning a promise", () => {
    const scene = new Scene(100, 100, { adapter });
    const group = new Group({}).add(
      new Morph({
        color: "#ff0000",
        size: { width: 50, height: 50 },
        position: { x: 0, y: 0 },
        centring: "none",
      }),
      new Group({ position: { x: 10, y: 10 } }).add(
        new Morph({
          color: "#00ff00",
          size: { width: 20, height: 20 },
          position: { x: 0, y: 0 },
          centring: "none",
        }),
      ),
    );
    scene.load(group);
    const canvas = adapter.createCanvas(100, 100);
    const ctx = canvas.getContext("2d");
    const result = group.draw(ctx, canvas, scene.lazyCanvas.manager, false);
    expect(isLater(result)).toBe(false);
  });

  it("eachInOrder runs the steps in order, waits for a promise and collects every error", async () => {
    const seen: number[] = [];
    const errors: unknown[] = [];
    const result = eachInOrder(
      [1, 2, 3, 4],
      (n) => {
        seen.push(n);
        if (n === 1) throw new Error("one");
        if (n === 2) return new Promise<void>((done) => setTimeout(done, 5));
        if (n === 3) return Promise.reject(new Error("three"));
      },
      errors,
    );
    expect(isLater(result)).toBe(true);
    expect(seen).toEqual([1, 2]);
    await result;
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(errors.map((e) => (e as Error).message)).toEqual(["one", "three"]);
  });

  it("eachInOrder is synchronous when nothing waits", () => {
    const errors: unknown[] = [];
    expect(eachInOrder([1, 2], () => undefined, errors)).toBeUndefined();
  });

  it("withFill hands a plain fill over at once and a promised one later", async () => {
    let used: unknown;
    expect(withFill("#fff", (f) => void (used = f))).toBeUndefined();
    expect(used).toBe("#fff");
    const later = withFill(Promise.resolve("pattern"), (f) => void (used = f));
    expect(isLater(later)).toBe(true);
    await later;
    expect(used).toBe("pattern");
  });

  it("keeps the order of layers around one that has to wait", async () => {
    // A red square, an image over it, then a green one over both: the last must be on top.
    const tile = adapter.createCanvas(4, 4);
    const c = tile.getContext("2d");
    c.fillStyle = "#0000ff";
    c.fillRect(0, 0, 4, 4);
    const scene = new Scene(40, 40, { adapter });
    scene.load(
      new Group({}).add(
        new Morph({
          color: "#ff0000",
          size: { width: 40, height: 40 },
          position: { x: 0, y: 0 },
          centring: "none",
        }),
        new Image({
          src: tile.toBuffer("image/png"),
          size: { width: 40, height: 40 },
          position: { x: 0, y: 0 },
          centring: "none",
        }),
        new Morph({
          color: "#00ff00",
          size: { width: 20, height: 20 },
          position: { x: 0, y: 0 },
          centring: "none",
        }),
      ),
    );
    await scene.renderFrame(0);
    const data = scene.getImageData();
    const at = (x: number, y: number) =>
      Array.from(data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 3));
    expect(at(5, 5)).toEqual([0, 255, 0]);
    expect(at(30, 30)).toEqual([0, 0, 255]);
  });

  it("draws the siblings of a layer that throws, then reports it", async () => {
    const scene = new Scene(40, 40, { adapter });
    const bad = new Morph({
      color: "#ff0000",
      size: { width: 10, height: 10 },
      position: { x: 0, y: 0 },
      centring: "none",
    });
    bad.draw = () => {
      throw new Error("boom");
    };
    scene.load(
      new Group({}).add(
        bad,
        new Morph({
          color: "#00ff00",
          size: { width: 40, height: 40 },
          position: { x: 0, y: 0 },
          centring: "none",
        }),
      ),
    );
    await expect(scene.renderFrame(0)).rejects.toThrow("boom");
    const data = scene.getImageData();
    expect(Array.from(data.slice(0, 3))).toEqual([0, 255, 0]);
  });
});

import * as zlib from "node:zlib";
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Group, Morph, Scene, createSignal } from "@nmmty/lazycanvas";
import { APNGEncoder, Exporter } from "@nmmty/lazycanvas/node";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

function sceneWithMotion() {
  const x = createSignal(0);
  const scene = new Scene(40, 20, { adapter });
  scene.load(
    new Group({}).add(
      new Morph({
        color: "#ff0000",
        size: { width: 10, height: 10 },
        position: { x, y: 5 },
        centring: "none",
      }),
    ),
  );
  scene.addAnimation(() => x.to(30, 1));
  return scene;
}

describe("Scene.frames", () => {
  it("hands over one frame per step of the range, ends included", async () => {
    const scene = sceneWithMotion();
    const seen: Array<[number, number]> = [];
    for await (const frame of scene.frames(0, 1, 10)) seen.push([frame.index, frame.time]);
    expect(seen.length).toBe(11);
    expect(seen[0]).toEqual([0, 0]);
    expect(seen[10][1]).toBeCloseTo(1, 12);
  });

  it("does not lose the last frame to the drift of adding 1/fps over and over", async () => {
    // 0.1 added ten times is 0.9999999999999999 and still passes; 0.1 * 3 is 0.30000000000000004 and
    // would not: the number of frames is worked out, not counted by adding up times.
    const scene = sceneWithMotion();
    let count = 0;
    for await (const _ of scene.frames(0, 0.3, 10)) count++;
    expect(count).toBe(4);
    expect((await sceneWithMotion().renderAnimationData(0, 0.7, 10)).length).toBe(8);
  });

  it("is empty when the range is backwards", async () => {
    const scene = sceneWithMotion();
    let count = 0;
    for await (const _ of scene.frames(1, 0, 10)) count++;
    expect(count).toBe(0);
  });

  it("draws the same pixels as renderFrame and getImageData", async () => {
    const scene = sceneWithMotion();
    const first: number[] = [];
    for await (const { data, time } of scene.frames(0, 1, 4))
      first.push(data.length, data[(5 * 40 + Math.round(time * 30) + 3) * 4]);

    const other = sceneWithMotion();
    for (let i = 0; i <= 4; i++) {
      await other.renderFrame(i / 4);
      const data = other.getImageData();
      expect(first[i * 2]).toBe(data.length);
      expect(first[i * 2 + 1]).toBe(data[(5 * 40 + Math.round((i / 4) * 30) + 3) * 4]);
    }
  });

  it("reuses one buffer when asked to, and gives each frame its own otherwise", async () => {
    const scene = sceneWithMotion();
    const reused = new Set<Uint8ClampedArray>();
    for await (const { data } of scene.frames(0, 1, 4, { reuse: true })) reused.add(data);
    expect(reused.size).toBe(1);

    const own = new Set<Uint8ClampedArray>();
    for await (const { data } of sceneWithMotion().frames(0, 1, 4)) own.add(data);
    expect(own.size).toBe(5);
  });

  it("renderAnimationData keeps every frame and matches the stream", async () => {
    const data = await sceneWithMotion().renderAnimationData(0, 1, 4);
    expect(data.length).toBe(5);
    const streamed: Uint8ClampedArray[] = [];
    for await (const { data: frame } of sceneWithMotion().frames(0, 1, 4)) streamed.push(frame);
    data.forEach((frame, i) =>
      expect(Buffer.from(frame).equals(Buffer.from(streamed[i]))).toBe(true),
    );
  });
});

describe("Scene.getImageData into a buffer", () => {
  it("fills the buffer it is given and returns it", async () => {
    const scene = sceneWithMotion();
    await scene.renderFrame(1);
    const into = new Uint8ClampedArray(40 * 20 * 4);
    expect(scene.getImageData(into)).toBe(into);
    expect(Buffer.from(into).equals(Buffer.from(scene.getImageData()))).toBe(true);
  });

  it("refuses a buffer of the wrong size", async () => {
    const scene = sceneWithMotion();
    await scene.renderFrame(0);
    expect(() => scene.getImageData(new Uint8ClampedArray(10))).toThrow(/frame is/);
  });
});

/** The chunks of a PNG/APNG file: type, data and whether the CRC is right. */
function chunks(file: Buffer) {
  const out: Array<{ type: string; data: Buffer; crcOk: boolean }> = [];
  let offset = 8;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    const crc = file.readUInt32BE(offset + 8 + length);
    out.push({
      type,
      data,
      crcOk: zlib.crc32(file.subarray(offset + 4, offset + 8 + length)) === crc,
    });
    offset += 12 + length;
  }
  return out;
}

describe("APNGEncoder", () => {
  const w = 5;
  const h = 3;
  const frame = (seed: number) =>
    Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i * 7 + seed * 31) & 255);

  it("writes a valid animation whose frames decompress to the pixels that were added", () => {
    const frames = [frame(1), frame(2), frame(3)];
    const file = new APNGEncoder(w, h, 30).addFrames(...frames).encode();

    expect(file.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const parts = chunks(file);
    expect(parts.every((c) => c.crcOk)).toBe(true);
    expect(parts.map((c) => c.type)).toEqual([
      "IHDR",
      "acTL",
      "fcTL",
      "IDAT",
      "fcTL",
      "fdAT",
      "fcTL",
      "fdAT",
      "IEND",
    ]);
    expect(parts[1].data.readUInt32BE(0)).toBe(3);

    const pixels = [parts[3], parts[5], parts[7]].map((c, i) =>
      zlib.inflateSync(i === 0 ? c.data : c.data.subarray(4)),
    );
    pixels.forEach((raw, i) => {
      for (let y = 0; y < h; y++) {
        expect(raw[y * (w * 4 + 1)]).toBe(0); // filter type
        expect([...raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))]).toEqual([
          ...frames[i].subarray(y * w * 4, (y + 1) * w * 4),
        ]);
      }
    });
  });

  it("does not keep the pixels it is given, so one buffer can be reused for every frame", () => {
    const reused = new Uint8ClampedArray(w * h * 4);
    const encoder = new APNGEncoder(w, h, 30);
    const expected = new APNGEncoder(w, h, 30);
    for (let i = 1; i <= 3; i++) {
      reused.set(frame(i));
      encoder.addFrame(reused);
      expected.addFrame(frame(i));
    }
    expect(encoder.getFrameCount()).toBe(3);
    expect(encoder.encode().equals(expected.encode())).toBe(true);
  });

  it("rejects a frame of the wrong size, and an empty animation", () => {
    expect(() => new APNGEncoder(w, h).addFrame(new Uint8ClampedArray(3))).toThrow(
      /Invalid ImageData/,
    );
    expect(() => new APNGEncoder(w, h).encode()).toThrow(/No frames/);
  });
});

describe("Exporter apng", () => {
  it("exports a scene frame by frame", async () => {
    const scene = sceneWithMotion();
    const file: Buffer = await new Exporter(scene).export("apng", { duration: 1, fps: 10 });
    const parts = chunks(file);
    expect(parts[1].type).toBe("acTL");
    expect(parts[1].data.readUInt32BE(0)).toBe(11);
    expect(parts.every((c) => c.crcOk)).toBe(true);
  });
});

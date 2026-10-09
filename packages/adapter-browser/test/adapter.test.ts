// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserCanvasAdapter } from "../src";

/** A stand-in for the browser's `Image` that loads or fails on the next tick. */
function stubImage(outcome: "load" | "error") {
  const created: Array<{ src: string; crossOrigin: string | null }> = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    width = 10;
    height = 10;
    private _src = "";
    set src(value: string) {
      this._src = value;
      created.push({ src: value, crossOrigin: this.crossOrigin });
      queueMicrotask(() => (outcome === "load" ? this.onload?.() : this.onerror?.()));
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return created;
}

function stubFonts(loadImpl: () => Promise<unknown> = () => Promise.resolve()) {
  const added: unknown[] = [];
  const fonts = {
    add: vi.fn((face: unknown) => added.push(face)),
    check: vi.fn(() => true),
    load: vi.fn(() => Promise.resolve([])),
    [Symbol.iterator]: () => added[Symbol.iterator](),
  };
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  class FakeFontFace {
    family: string;
    constructor(
      family: string,
      public source: string,
    ) {
      this.family = family;
    }
    load() {
      return loadImpl().then(() => this);
    }
  }
  vi.stubGlobal("FontFace", FakeFontFace);
  return fonts;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrowserCanvasAdapter canvases", () => {
  it("creates a detached canvas of the requested size", () => {
    const canvas = new BrowserCanvasAdapter().createCanvas(120, 60);
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(60);
  });

  it("reuses and resizes the canvas it was constructed with", () => {
    const element = document.createElement("canvas");
    const adapter = new BrowserCanvasAdapter(element);
    const canvas = adapter.createCanvas(300, 150);
    expect(canvas).toBe(element);
    expect(element.width).toBe(300);
    expect(element.height).toBe(150);
  });
});

describe("BrowserCanvasAdapter fonts", () => {
  it("cannot register from a path and says why", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(new BrowserCanvasAdapter().fonts.registerFromPath("/a.ttf", "A")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("@font-face"));
  });

  it("registers a base64 font and waits for it in fontsReady", async () => {
    let finish!: () => void;
    const fonts = stubFonts(() => new Promise<void>((resolve) => (finish = resolve)));
    const adapter = new BrowserCanvasAdapter();

    expect(adapter.fonts.register("AAAA", "Demo")).toBe(true);
    expect(fonts.add).not.toHaveBeenCalled();

    let ready = false;
    const pending = adapter.fontsReady().then(() => (ready = true));
    await Promise.resolve();
    expect(ready).toBe(false);

    finish();
    await pending;
    expect(ready).toBe(true);
    expect(fonts.add).toHaveBeenCalledTimes(1);
  });

  it("does not let a failing font break fontsReady", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFonts(() => Promise.reject(new Error("bad font")));
    const adapter = new BrowserCanvasAdapter();
    expect(adapter.fonts.register("AAAA", "Broken")).toBe(true);
    await expect(adapter.fontsReady()).resolves.toBeUndefined();
  });

  it("refuses to register when the FontFace API is missing", () => {
    vi.stubGlobal("FontFace", undefined);
    expect(new BrowserCanvasAdapter().fonts.register("AAAA", "Demo")).toBe(false);
  });

  it("asks document.fonts.load for every spec and ignores unknown families", async () => {
    const fonts = stubFonts();
    fonts.load.mockImplementation(((spec: string) =>
      spec.includes("Missing")
        ? Promise.reject(new Error("no such font"))
        : Promise.resolve([])) as never);

    await new BrowserCanvasAdapter().loadFonts(['400 16px "Geist"', '400 16px "Missing"']);
    expect(fonts.load).toHaveBeenCalledTimes(2);
    expect(fonts.load).toHaveBeenCalledWith('400 16px "Geist"');
  });

  it("checks registered families through document.fonts", () => {
    stubFonts();
    const adapter = new BrowserCanvasAdapter();
    adapter.fonts.register("AAAA", "Demo");
    expect(adapter.fonts.has("Demo")).toBe(true);
  });
});

describe("BrowserCanvasAdapter images", () => {
  it("loads an image from a URL without allocating an object URL", async () => {
    const created = stubImage("load");
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));

    const image = await new BrowserCanvasAdapter().loadImage("https://example.com/a.png");
    expect(image.width).toBe(10);
    expect(created[0].src).toBe("https://example.com/a.png");
    expect(created[0].crossOrigin).toBe("anonymous");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("turns binary data into an object URL and releases it afterwards", async () => {
    const created = stubImage("load");
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));

    await new BrowserCanvasAdapter().loadImage(new Uint8Array([1, 2, 3]));
    expect(created[0].src).toBe("blob:fake");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("copies a typed-array view instead of leaking its whole backing buffer", async () => {
    stubImage("load");
    let blob: Blob | undefined;
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (b: Blob) => {
          blob = b;
          return "blob:fake";
        },
        revokeObjectURL: vi.fn(),
      }),
    );

    const backing = new Uint8Array([9, 9, 1, 2, 3, 9, 9]);
    await new BrowserCanvasAdapter().loadImage(backing.subarray(2, 5));
    expect(blob?.size).toBe(3);
  });

  it("rejects when the image fails to load and still releases the object URL", async () => {
    stubImage("error");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:fake", revokeObjectURL }),
    );

    await expect(new BrowserCanvasAdapter().loadImage(new Uint8Array([1]))).rejects.toThrow(
      /Failed to load image/,
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("rejects sources it cannot handle", async () => {
    stubImage("load");
    await expect(new BrowserCanvasAdapter().loadImage({} as unknown as string)).rejects.toThrow(
      /Unsupported image source/,
    );
  });
});

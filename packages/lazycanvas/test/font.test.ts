import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Centring, Div, Scene, TextLayer, cssFont, cssFontFamily } from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

describe("cssFontFamily", () => {
  it("quotes a named family and appends a fallback", () => {
    // Without the fallback an unknown family resolves to the browser's
    // standard font, which is a serif — that is where the stray Times New
    // Roman text came from.
    expect(cssFontFamily("Geist Mono")).toBe('"Geist Mono", sans-serif');
    expect(cssFontFamily("Geist")).toBe('"Geist", sans-serif');
  });

  it("leaves generic keywords alone", () => {
    for (const generic of ["serif", "sans-serif", "monospace", "system-ui", "cursive"]) {
      expect(cssFontFamily(generic)).toBe(generic);
    }
  });

  it("is case insensitive about generics", () => {
    expect(cssFontFamily("Sans-Serif")).toBe("Sans-Serif");
  });

  it("passes an author-supplied stack straight through", () => {
    expect(cssFontFamily('"My Font", Helvetica, sans-serif')).toBe(
      '"My Font", Helvetica, sans-serif',
    );
    expect(cssFontFamily("geistMono, 'geistMono Fallback'")).toBe(
      "geistMono, 'geistMono Fallback'",
    );
  });

  it("falls back entirely for an empty family", () => {
    expect(cssFontFamily("")).toBe("sans-serif");
  });

  it("honours an explicit fallback", () => {
    expect(cssFontFamily("Geist Mono", "monospace")).toBe('"Geist Mono", monospace');
    expect(cssFontFamily("Geist Mono", "")).toBe('"Geist Mono"');
  });
});

describe("cssFont", () => {
  it("builds a CSS font shorthand", () => {
    expect(cssFont({ family: "Geist", size: 24, weight: 700 })).toBe(
      '700 24px "Geist", sans-serif',
    );
  });

  it("accepts a size override for the auto-fitting pass", () => {
    expect(cssFont({ family: "Geist", size: 24, weight: 400 }, 12)).toBe(
      '400 12px "Geist", sans-serif',
    );
  });
});

describe("text rendering falls back predictably", () => {
  const widthOf = (family: string) => {
    const canvas = adapter.createCanvas(400, 100);
    const ctx = canvas.getContext("2d");
    ctx.font = cssFont({ family, size: 32, weight: 400 });
    return ctx.measureText("Hello World").width;
  };

  it("an unknown family measures as the sans-serif fallback", () => {
    // In a browser this is what stops an unknown family from resolving to the
    // standard serif font. Node cannot assert the serif/sans distinction: a
    // headless container usually maps both generics to the same physical font.
    expect(widthOf("This Family Does Not Exist")).toBeCloseTo(widthOf("sans-serif"), 1);
  });

  it("a registered family is actually used", () => {
    const scene = new Scene(300, 60, { adapter });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);

    const canvas = adapter.createCanvas(400, 100);
    const ctx = canvas.getContext("2d");

    ctx.font = cssFont({ family: "Geist", size: 32, weight: 400 });
    const geist = ctx.measureText("Hello World").width;

    ctx.font = cssFont({ family: "sans-serif", size: 32, weight: 400 });
    const fallback = ctx.measureText("Hello World").width;

    expect(geist).toBeGreaterThan(0);
    expect(geist).not.toBeCloseTo(fallback, 1);
  });

  it("renders a TextLayer with a multi-word family", async () => {
    const scene = new Scene(300, 80, { adapter });
    scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
    scene.load(
      new Div().add(
        new TextLayer({
          text: "Geist Mono",
          color: "#ffffff",
          font: { family: "Geist Mono", size: 28, weight: 400 },
          position: { x: 10, y: 50 },
          centring: Centring.None,
        }),
      ),
    );
    await scene.renderFrame(0);

    const data = scene.getImageData();
    let lit = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) lit++;
    expect(lit).toBeGreaterThan(200);
  });
});

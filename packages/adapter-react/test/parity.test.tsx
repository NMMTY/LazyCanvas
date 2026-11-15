// @vitest-environment happy-dom
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import * as lc from "@nmmty/lazycanvas";
import { StrictMode, act, createElement as reactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as components from "../src";
import { Scene } from "../src";
import { installCanvasSurfaces, surfaceOf } from "./helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(installCanvasSurfaces);

/**
 * Moving code between `@nmmty/lazycanvas` and `@nmmty/adapter-react` is meant to be a change of the
 * import line only. Every case below is written once as a function of the layer classes `L` and an
 * element factory `h`, then built twice: with the core classes and `lc.createElement`, and with the
 * React components and `React.createElement`. Both trees are drawn and the pixels must be identical.
 */
type Layers = Pick<
  typeof lc,
  "Bezier" | "Group" | "Line" | "Morph" | "Path2D" | "Polygon" | "Quadratic" | "Text"
>;
type Factory = (type: any, props?: any, ...children: any[]) => any;
type Case = { width: number; height: number; tree: (L: Layers, h: Factory) => unknown };

const font = { family: "sans-serif", size: 18, weight: 400 };

const cases: Record<string, Case> = {
  "a morph at the root": {
    width: 80,
    height: 60,
    tree: (L, h) =>
      h(L.Morph, {
        color: "#ff0000",
        size: { width: 40, height: 30 },
        position: { x: 40, y: 30 },
        radius: 8,
      }),
  },
  "a group laying out its children": {
    width: 120,
    height: 80,
    tree: (L, h) =>
      h(
        L.Group,
        { size: { width: 120, height: 80 }, layout: { direction: "row", gap: 10, padding: 10 } },
        h(L.Morph, { color: "#00ff00", size: { width: 30, height: 30 } }),
        h(L.Morph, { color: "#0000ff", size: { width: 40, height: 20 } }),
      ),
  },
  "nested groups with z-index and opacity": {
    width: 100,
    height: 100,
    tree: (L, h) =>
      h(
        L.Group,
        { size: { width: 100, height: 100 } },
        h(L.Morph, { color: "#ff0000", size: { width: 60, height: 60 }, zIndex: 1 }),
        h(
          L.Group,
          { size: { width: 60, height: 60 }, zIndex: 2, opacity: 0.5 },
          h(L.Morph, { color: "#00ff00", size: { width: 40, height: 40 } }),
        ),
      ),
  },
  "a line, a quadratic and a bezier": {
    width: 120,
    height: 80,
    tree: (L, h) =>
      h(
        L.Group,
        { size: { width: 120, height: 80 } },
        h(L.Line, {
          position: { x: 10, y: 10, endX: 110, endY: 10 },
          color: "#ff0000",
          filled: false,
          stroke: { width: 4 },
        }),
        h(L.Quadratic, {
          position: { x: 10, y: 70, endX: 110, endY: 70 },
          controlPoints: [{ x: 60, y: 20 }],
          color: "#00ff00",
          filled: false,
          stroke: { width: 4 },
        }),
        h(L.Bezier, {
          position: { x: 10, y: 40, endX: 110, endY: 40 },
          controlPoints: [
            { x: 40, y: 10 },
            { x: 80, y: 70 },
          ],
          color: "#0000ff",
          filled: false,
          stroke: { width: 4 },
        }),
      ),
  },
  "a polygon": {
    width: 80,
    height: 80,
    tree: (L, h) =>
      h(L.Polygon, {
        sides: 6,
        color: "#ff00ff",
        size: { width: 60, height: 60 },
        position: { x: 40, y: 40 },
      }),
  },
  text: {
    width: 120,
    height: 40,
    tree: (L, h) =>
      h(L.Text, { text: "Hello", color: "#000000", font, position: { x: 10, y: 10 } }),
  },
};

let container: HTMLDivElement;

afterEach(() => container?.remove());

/** Draws the tree through `<Scene>` and returns the RGBA bytes of its canvas. */
async function drawWithReact({ width, height, tree }: Case): Promise<Uint8ClampedArray> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const element = tree(components as unknown as Layers, reactElement) as React.ReactNode;
  await act(async () => {
    root.render(
      <StrictMode>
        <Scene width={width} height={height}>
          {element}
        </Scene>
      </StrictMode>,
    );
  });
  // The scene builds its tree and draws asynchronously (Yoga loads lazily).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  const surface = surfaceOf(container.querySelector("canvas") as HTMLCanvasElement);
  const { data } = surface.getContext("2d").getImageData(0, 0, width, height);
  await act(async () => root.unmount());
  return new Uint8ClampedArray(data);
}

/** Draws the same tree with the classes of the core package. */
async function drawWithCore({ width, height, tree }: Case): Promise<Uint8ClampedArray> {
  const scene = new lc.Scene(width, height, { adapter: new NodeCanvasAdapter() });
  scene.load(tree(lc, lc.createElement) as lc.Group);
  await scene.renderFrame(0);
  return scene.getImageData();
}

const inked = (data: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
  return n;
};

describe("the same tree through @nmmty/lazycanvas and @nmmty/adapter-react", () => {
  for (const [name, spec] of Object.entries(cases)) {
    it(`draws identical pixels for ${name}`, async () => {
      const react = await drawWithReact(spec);
      const core = await drawWithCore(spec);
      // Guards against both sides drawing nothing and "matching".
      expect(inked(core)).toBeGreaterThan(50);
      expect(react).toHaveLength(core.length);
      expect(Buffer.from(react).equals(Buffer.from(core))).toBe(true);
    });
  }

  it("exports a component for every layer class of the core", () => {
    for (const name of [
      "Morph",
      "Text",
      "Image",
      "Line",
      "Bezier",
      "Quadratic",
      "Polygon",
      "Path2D",
      "Group",
    ]) {
      expect(components).toHaveProperty(name);
      expect(lc).toHaveProperty(name);
    }
  });
});

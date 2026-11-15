// @vitest-environment happy-dom
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { FontsManager } from "@nmmty/lazycanvas";
import * as lc from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";
import { StrictMode, act, createRef, useState } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Group,
  Morph,
  Scene,
  type SceneRef,
  Text,
  createLayerComponent,
  registerLayer,
  useScene,
} from "../src";
import { installCanvasSurfaces, surfaceOf } from "./helpers";

// React only flushes effects inside act() when this flag is set.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  installCanvasSurfaces();
  // Register bundled fonts with @napi-rs/canvas (the patched 2D backend). CI runners
  // often have no fontconfig entry for `sans-serif`, so text tests use Geist.
  new FontsManager({ adapter: new NodeCanvasAdapter() }).loadFonts(Fonts);
});

/** Counts pixels of the surface behind `element` that match a predicate. */
function countPixels(
  element: HTMLCanvasElement,
  match: (r: number, g: number, b: number, a: number) => boolean,
): number {
  const surface = surfaceOf(element);
  const { data } = surface.getContext("2d").getImageData(0, 0, surface.width, surface.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4)
    if (match(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
  return n;
}

const isGreen = (r: number, g: number, b: number, a: number) =>
  g > 200 && r < 40 && b < 40 && a > 200;
const isRed = (r: number, g: number, b: number, a: number) =>
  r > 200 && g < 40 && b < 40 && a > 200;

let container: HTMLDivElement;
let root: Root;

async function render(ui: React.ReactNode) {
  await act(async () => {
    root.render(ui);
  });
  // The scene builds its tree and draws asynchronously (Yoga loads lazily).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const canvasOf = () => container.querySelector("canvas") as HTMLCanvasElement;

describe("<Scene>", () => {
  it("renders a canvas element with the requested size and passes className/style", async () => {
    await render(
      <Scene width={120} height={80} className="demo" style={{ border: "1px solid red" }}>
        <Morph color="#00ff00" size={{ width: 120, height: 80 }} />
      </Scene>,
    );
    const canvas = canvasOf();
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(80);
    expect(canvas.className).toBe("demo");
  });

  it("draws its children onto the canvas", async () => {
    await render(
      <Scene width={100} height={100}>
        <Morph color="#00ff00" size={{ width: 100, height: 100 }} />
      </Scene>,
    );
    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(9000);
  });

  it("nests layers inside <Group> and lays them out as a flex row", async () => {
    await render(
      <Scene width={100} height={100}>
        <Group layout={{ flexDirection: "row", width: 100, height: 100 }}>
          <Morph color="#ff0000" layout={{ width: 50, height: 100 }} />
          <Morph color="#00ff00" layout={{ width: 50, height: 100 }} />
        </Group>
      </Scene>,
    );
    const canvas = canvasOf();
    expect(countPixels(canvas, isGreen)).toBeGreaterThan(4000);
    expect(countPixels(canvas, isRed)).toBeGreaterThan(4000);
  });

  it("redraws when props change", async () => {
    function Demo() {
      const [color, setColor] = useState("#ff0000");
      return (
        <>
          <button type="button" onClick={() => setColor("#00ff00")}>
            go
          </button>
          <Scene width={60} height={60}>
            <Morph color={color} size={{ width: 60, height: 60 }} />
          </Scene>
        </>
      );
    }
    await render(<Demo />);
    expect(countPixels(canvasOf(), isRed)).toBeGreaterThan(3000);

    await act(async () => {
      container.querySelector("button")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(3000);
    expect(countPixels(canvasOf(), isRed)).toBe(0);
  });

  it("shows the last of a burst of changes and draws fewer frames than there were changes", async () => {
    const colors = ["#ff0000", "#0000ff", "#ffff00", "#ff00ff", "#00ff00"];
    const onFrame = vi.fn();
    function Demo({ color }: { color: string }) {
      return (
        <Scene width={60} height={60} onFrame={onFrame}>
          <Morph color={color} size={{ width: 60, height: 60 }} />
        </Scene>
      );
    }
    await render(<Demo color="#ff0000" />);
    onFrame.mockClear();

    // The changes land one after another, faster than a frame is drawn.
    for (const color of colors) {
      await act(async () => root.render(<Demo color={color} />));
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(3000);
    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(colors.length);
    expect(onFrame.mock.calls.length).toBeGreaterThan(0);
  });

  it("copies the finished frame from a back buffer, so the visible canvas is not the scene's canvas", async () => {
    const onReady = vi.fn();
    const onFrame = vi.fn();
    await render(
      <Scene width={50} height={50} onReady={onReady} onFrame={onFrame}>
        <Morph color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    const [scene, shown] = onReady.mock.calls[0];
    expect(shown).toBe(canvasOf());
    expect(scene.lazyCanvas.canvas).not.toBe(canvasOf());
    // onFrame sees the scene's canvas holding the frame; the page canvas gets it right after.
    expect(onFrame.mock.calls[0][0]).toBe(scene);
    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(2000);
  });

  it("keeps layer pictures between frames, and not when asked not to", async () => {
    const blob = (color: string) => (
      <Morph color={color} filter="blur(4px)" size={{ width: 40, height: 40 }} />
    );
    const statsAfter = async (cache: boolean | undefined) => {
      const onReady = vi.fn();
      function Demo({ color }: { color: string }) {
        return (
          <Scene width={60} height={60} onReady={onReady} cache={cache}>
            {blob(color)}
          </Scene>
        );
      }
      await render(<Demo color="#ff0000" />);
      await render(<Demo color="#00ff00" />);
      await render(<Demo color="#0000ff" />);
      return onReady.mock.calls[0][0].cacheStats();
    };

    // The blur is computed once; the other two frames only repaint it.
    expect(await statsAfter(undefined)).toMatchObject({ misses: 1, tinted: 2 });
    expect(await statsAfter(false)).toBeUndefined();
  });

  it("calls onReady once with the scene and canvas, and onFrame after drawing", async () => {
    const onReady = vi.fn();
    const onFrame = vi.fn();
    await render(
      <Scene width={50} height={50} onReady={onReady} onFrame={onFrame}>
        <Morph color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0][0]).toHaveProperty("lazyCanvas");
    expect(onFrame).toHaveBeenCalled();
  });

  it("does not rebuild the scene when only callback identities change", async () => {
    const onReady = vi.fn();
    const tree = (cb: () => void) => (
      <Scene width={50} height={50} onReady={onReady} onFrame={cb}>
        <Morph color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>
    );
    await render(tree(() => {}));
    await render(tree(() => {}));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("exposes the scene through the ref", async () => {
    const ref = createRef<SceneRef>();
    await render(
      <Scene ref={ref} width={50} height={50}>
        <Morph id="box" color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    expect(ref.current?.scene).toBeTruthy();
    expect(ref.current?.getLayer("box")).toBeTruthy();
    await expect(ref.current?.renderFrame(0)).resolves.toBeUndefined();
  });

  it("clears the ref and stops drawing after unmount", async () => {
    const ref = createRef<SceneRef>();
    await render(
      <Scene ref={ref} width={50} height={50}>
        <Morph color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    await act(async () => root.render(null));
    expect(ref.current).toBeNull();
  });

  it("survives React StrictMode double-mounting", async () => {
    await render(
      <StrictMode>
        <Scene width={60} height={60}>
          <Morph color="#00ff00" size={{ width: 60, height: 60 }} />
        </Scene>
      </StrictMode>,
    );
    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(3000);
  });

  it("draws with an explicitly supplied adapter", async () => {
    const adapter = new NodeCanvasAdapter();
    const onReady = vi.fn();
    await render(
      <Scene width={40} height={40} adapter={adapter} onReady={onReady}>
        <Morph color="#00ff00" size={{ width: 40, height: 40 }} />
      </Scene>,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
    // The scene owns a Node surface, so the DOM canvas stays untouched.
    expect(countPixels(canvasOf(), isGreen)).toBe(0);
  });

  it("does not draw when autoRender is off", async () => {
    await render(
      <Scene width={40} height={40} autoRender={false}>
        <Morph color="#00ff00" size={{ width: 40, height: 40 }} />
      </Scene>,
    );
    expect(countPixels(canvasOf(), isGreen)).toBe(0);
  });

  it("renders text layers", async () => {
    await render(
      <Scene width={200} height={60}>
        <Text text="Hello" color="#00ff00" font={{ family: "Geist", size: 32, weight: 400 }} />
      </Scene>,
    );
    // No guarantee which glyph shapes the font has, only that ink was drawn.
    expect(countPixels(canvasOf(), (_r, _g, _b, a) => a > 0)).toBeGreaterThan(0);
  });
});

describe("useScene", () => {
  it("is empty outside a <Scene>", async () => {
    let seen: ReturnType<typeof useScene> | undefined;
    function Probe() {
      seen = useScene();
      return null;
    }
    await render(<Probe />);
    expect(seen?.scene).toBeNull();
  });
});

describe("layer registration", () => {
  it("registerLayer makes a custom layer class usable in a <Scene>", async () => {
    const Tile = registerLayer("TestTile", lc.Morph as never) as React.ComponentType<
      Record<string, unknown>
    >;
    await render(
      <Scene width={50} height={50}>
        <Tile color="#00ff00" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    expect(countPixels(canvasOf(), isGreen)).toBeGreaterThan(2000);
  });

  it("createLayerComponent wraps a layer class the same way", async () => {
    const Tile = createLayerComponent(lc.Morph as never, "TestTile2") as React.ComponentType<
      Record<string, unknown>
    >;
    await render(
      <Scene width={50} height={50}>
        <Tile color="#ff0000" size={{ width: 50, height: 50 }} />
      </Scene>,
    );
    expect(countPixels(canvasOf(), isRed)).toBeGreaterThan(2000);
  });

  it("registerLayer returns the same component for the same name", () => {
    const a = registerLayer("SameName", lc.Morph as never);
    const b = registerLayer("SameName", lc.Morph as never);
    expect(a).toBe(b);
  });
});

describe("refs", () => {
  it("a ref on a layer component receives the layer instance, as in the core JSX runtime", async () => {
    const objectRef = createRef<Morph>();
    let callbackLayer: Text | null = null;
    await render(
      <Scene width={50} height={50}>
        <Morph ref={objectRef} id="boxed" color="#00ff00" size={{ width: 50, height: 50 }} />
        <Text
          ref={(layer) => {
            if (layer) callbackLayer = layer;
          }}
          text="hi"
          font={{ family: "sans-serif", size: 10, weight: 400 }}
        />
      </Scene>,
    );
    expect(objectRef.current).toBeInstanceOf(lc.Morph);
    expect(objectRef.current?.id).toBe("boxed");
    expect(callbackLayer).toBeInstanceOf(lc.Text);
  });
});

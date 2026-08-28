import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Div, Easing, MorphLayer, Scene, Signal } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

describe("signal-driven props", () => {
  it("animates a manually positioned layer across frames", async () => {
    const x = new Signal(60);
    const box = new MorphLayer(
      {
        color: "#ff0000",
        size: { width: 20, height: 20 },
        position: { x, y: 10 },
      },
      { id: "box" },
    );

    const scene = new Scene(400, 100, { adapter });
    scene.load(new Div({}, { id: "root" }).add(box));
    scene.playAnimation(x, x.to(360, 1, { easing: Easing.linear }));

    await scene.renderFrame(0);
    const start = box.props.position?.x;

    await scene.renderFrame(0.5);
    const mid = box.props.position?.x;

    await scene.renderFrame(1);
    const end = box.props.position?.x;

    expect(start).toBe(60);
    expect(mid).toBeGreaterThan(60);
    expect(mid).toBeLessThan(360);
    expect(end).toBe(360);
  });
});

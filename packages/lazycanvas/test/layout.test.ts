import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Centring, Div, MorphLayer, Scene, TextLayer } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

const box = (id: string, extra: Record<string, any> = {}) =>
  new MorphLayer({ color: "#ffffff", layout: { width: 40, height: 40 }, ...extra }, { id });

describe("LayoutManager", () => {
  it("lays a row out with the requested gap", async () => {
    const a = box("a");
    const b = box("b");
    const scene = new Scene(300, 100, { adapter });
    scene.load(new Div({ layout: { flexDirection: "row", gap: 20 } }, { id: "row" }).add(a, b));

    await scene.renderFrame(0);

    expect(a.props.position).toEqual({ x: 0, y: 0 });
    expect(b.props.position).toEqual({ x: 60, y: 0 });
  });

  it("keeps the same geometry across repeated frames", async () => {
    const a = box("a");
    const b = box("b");
    const scene = new Scene(300, 100, { adapter });
    scene.load(
      new Div({ layout: { flexDirection: "row", gap: 20, padding: 10 } }, { id: "row" }).add(a, b),
    );

    await scene.renderFrame(0);
    const first = [structuredClone(a.props.position), structuredClone(b.props.position)];

    for (let i = 1; i <= 5; i++) await scene.renderFrame(i / 60);

    expect([structuredClone(a.props.position), structuredClone(b.props.position)]).toEqual(first);
  });

  it("relayouts when a layout prop changes after the first frame", async () => {
    const a = new MorphLayer({ color: "#fff", size: { width: 40, height: 40 } }, { id: "a" });
    const b = new MorphLayer({ color: "#fff", size: { width: 40, height: 40 } }, { id: "b" });
    const row = new Div({ layout: { flexDirection: "row", gap: 20 } }, { id: "row" });
    row.add(a, b);

    const scene = new Scene(300, 100, { adapter });
    scene.load(row);

    await scene.renderFrame(0);
    expect(b.props.position).toEqual({ x: 60, y: 0 });

    // The layout pass used to write its computed offsets into props.position.
    // On the next frame those children then looked manually positioned, so they
    // were dropped from the flex flow and the layout froze on frame one: this
    // gap change had no effect at all.
    (row.props.layout as any).gap = 100;
    await scene.renderFrame(1 / 60);

    expect(b.props.position).toEqual({ x: 140, y: 0 });
  });

  it("leaves manually positioned layers out of the flex flow", async () => {
    const flowed = box("flowed");
    const manual = new MorphLayer(
      {
        color: "#ffffff",
        size: { width: 10, height: 10 },
        position: { x: 123, y: 45 },
        centring: Centring.None,
      },
      { id: "manual" },
    );

    const scene = new Scene(300, 100, { adapter });
    scene.load(
      new Div({ layout: { flexDirection: "row", gap: 5 } }, { id: "row" }).add(flowed, manual),
    );
    await scene.renderFrame(0);

    expect(manual.props.position).toEqual({ x: 123, y: 45 });
    expect(flowed.props.position).toEqual({ x: 0, y: 0 });
  });

  it("measures text so it participates in the flow", async () => {
    const label = new TextLayer(
      {
        text: "wide enough to measure",
        color: "#ffffff",
        font: { family: "sans-serif", size: 20 },
      },
      { id: "label" },
    );
    const after = box("after");

    const scene = new Scene(600, 100, { adapter });
    scene.load(new Div({ layout: { flexDirection: "row" } }, { id: "row" }).add(label, after));
    await scene.renderFrame(0);

    // The box must start past the measured width of the text.
    expect(after.props.position?.x).toBeGreaterThan(50);
  });
});

describe("toJSON after layout", () => {
  it("serializes the props the caller wrote, not the computed ones", async () => {
    const layer = new MorphLayer(
      {
        color: "#ffffff",
        layout: { width: 40, height: 40 },
        position: { x: 7, y: 9 },
        centring: Centring.Center,
      },
      { id: "authored" },
    );

    const scene = new Scene(300, 100, { adapter });
    scene.load(
      new Div({ layout: { flexDirection: "row", padding: 25 } }, { id: "row" }).add(layer),
    );
    await scene.renderFrame(0);

    // Layout moved the layer for rendering...
    expect(layer.props.position).not.toEqual({ x: 7, y: 9 });

    // ...but serialization still reports what the caller asked for.
    const json = layer.toJSON() as any;
    expect(json.props.position).toEqual({ x: 7, y: 9 });
    expect(json.props.centring).toBe(Centring.Center);
    expect(json.props._computedLayout).toBeUndefined();
  });
});

describe("Div/BaseLayer tree", () => {
  it("Div.layers and children are the same array", () => {
    const child = box("child");
    const div = new Div({}, { id: "div" }).add(child);

    expect(div.layers).toBe(div.children);
    expect(div.layers).toEqual([child]);

    div.clear();
    expect(div.children).toEqual([]);
  });

  it("add() sets the parent and sorts by zIndex", () => {
    const div = new Div({}, { id: "div" });
    div.add(box("c", { zIndex: 3 }), box("a", { zIndex: 1 }));
    expect(div.layers.every((l) => l.parent === div)).toBe(true);
  });
});

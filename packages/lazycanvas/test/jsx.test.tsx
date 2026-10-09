/** @jsxImportSource @nmmty/lazycanvas */
import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Div, MorphLayer, Scene, TextLayer } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

describe("jsxImportSource", () => {
  it("builds layer instances from JSX", () => {
    const tree = (
      <MorphLayer color="#00ff00" size={{ width: 10, height: 10 }}>
        <TextLayer text="hi" />
      </MorphLayer>
    );
    expect(tree).toBeInstanceOf(MorphLayer);
  });

  it("renders a JSX tree to pixels", async () => {
    const scene = new Scene(40, 40, { adapter });
    scene.load(
      <Div>
        <MorphLayer color="#00ff00" size={{ width: 40, height: 40 }} />
      </Div>,
    );
    await scene.renderFrame(0);
    const { data } = scene.lazyCanvas.ctx.getImageData(0, 0, 40, 40);
    expect([data[0], data[1], data[2], data[3]]).toEqual([0, 255, 0, 255]);
  });

  it("flattens fragments and drops falsy children", () => {
    const row = (
      <Div>
        <>
          <MorphLayer id="a" />
          {false}
          {null}
        </>
        <MorphLayer id="b" />
      </Div>
    );
    expect(row.children?.map((c: { id: string }) => c.id)).toEqual(["a", "b"]);
  });
});

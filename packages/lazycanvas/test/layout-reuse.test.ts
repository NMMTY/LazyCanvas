import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import { Group, Morph, Scene, Text, createSignal, walkLayers } from "@nmmty/lazycanvas";
import { Fonts } from "@nmmty/lazycanvas/fonts";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

interface Tree {
  root: Group;
  /** Whatever the case wants to change later on. */
  handles: Record<string, any>;
}

/** What the layout wrote into every layer. */
function geometry(root: Group) {
  const out: unknown[] = [];
  for (const layer of walkLayers(root)) {
    const props = (layer as any).props ?? {};
    out.push({
      id: layer.id,
      position: props.position,
      size: props.size,
      centring: props.centring,
      computed: props._computedLayout,
    });
  }
  return JSON.stringify(out);
}

function sceneFor(tree: Tree, reuse: boolean) {
  const scene = new Scene(400, 300, { adapter });
  scene.lazyCanvas.manager.fonts.loadFonts(Fonts);
  scene.lazyCanvas.manager.layout.reuse = reuse;
  scene.load(tree.root);
  return scene;
}

/**
 * Builds the same tree twice, lays one out afresh on every frame and the other with the last answer reused,
 * changes both in the same way and checks that they come out the same on every frame.
 */
async function sameAsAlwaysLayingOut(
  build: (tag: string) => Tree,
  change: (frame: number, tree: Tree) => void,
  frames = 8,
) {
  const reused = build("a");
  const fresh = build("b");
  const reusedScene = sceneFor(reused, true);
  const freshScene = sceneFor(fresh, false);

  for (let frame = 0; frame < frames; frame++) {
    change(frame, reused);
    change(frame, fresh);
    await reusedScene.renderFrame(frame / 60);
    await freshScene.renderFrame(frame / 60);
    expect(geometry(reused.root).replaceAll("a-", ""), `frame ${frame}`).toBe(
      geometry(fresh.root).replaceAll("b-", ""),
    );
  }
  return {
    reused: reusedScene.lazyCanvas.manager.layout.stats,
    fresh: freshScene.lazyCanvas.manager.layout.stats,
  };
}

const box = (id: string, layout: Record<string, any> = { width: 40, height: 30 }) =>
  new Morph({ color: "#fff", layout }, { id });
const label = (id: string, text: any, size = 16) =>
  new Text({ text, color: "#fff", font: { family: "Geist", size, weight: 400 } } as any, { id });

const row = (tag: string): Tree => {
  const root = new Group(
    { layout: { flexDirection: "row", gap: 10, padding: 8 } },
    { id: `${tag}-row` },
  );
  const a = box(`${tag}-a`);
  const b = box(`${tag}-b`, { width: 60, height: 30 });
  const c = label(`${tag}-c`, "hello");
  root.add(a, b, c);
  return { root, handles: { root, a, b, c } };
};

describe("layout reuse", () => {
  it("skips the pass while nothing changes, and does not move anything", async () => {
    const stats = await sameAsAlwaysLayingOut(row, () => {}, 10);
    expect(stats.reused.passes).toBe(1);
    expect(stats.reused.skipped).toBe(9);
    expect(stats.fresh.passes).toBe(10);
  });

  it("lays out again when a layout rule changes", async () => {
    const stats = await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 3) t.handles.root.props.layout.gap = 30;
      if (frame === 5) t.handles.a.props.layout.width = 90;
      if (frame === 6) t.handles.b.props.layout = { width: 20, height: 80, flexGrow: 1 };
    });
    expect(stats.reused.passes).toBeGreaterThanOrEqual(4);
    expect(stats.reused.skipped).toBeGreaterThan(0);
  });

  it("follows a layout rule that a signal drives", async () => {
    const stats = await sameAsAlwaysLayingOut(
      (tag) => {
        const gap = createSignal(0);
        const root = new Group({ layout: { flexDirection: "row", gap } }, { id: `${tag}-row` });
        root.add(box(`${tag}-a`), box(`${tag}-b`));
        const scene = null;
        void scene;
        return { root, handles: { gap } };
      },
      (frame, t) => t.handles.gap.set(frame * 5),
    );
    expect(stats.reused.skipped).toBe(0);
  });

  it("lays out again when the text in the flow changes size", async () => {
    await sameAsAlwaysLayingOut(
      (tag) => {
        const text = createSignal("a");
        const root = new Group({ layout: { flexDirection: "row", gap: 4 } }, { id: `${tag}-row` });
        const t = label(`${tag}-t`, text);
        root.add(t, box(`${tag}-after`));
        return { root, handles: { text, t } };
      },
      (frame, t) => t.handles.text.set("w".repeat(1 + frame * 2)),
    );
  });

  it("lays out again when the font of text in the flow changes", async () => {
    const stats = await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 4) t.handles.c.props.font = { family: "GeistMono", size: 30, weight: 400 };
    });
    expect(stats.reused.passes).toBeGreaterThanOrEqual(2);
  });

  it("lays out again when a layer is added or removed", async () => {
    await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 2)
        t.handles.root.add(
          box(`${t.handles.root.id.split("-")[0]}-new`, { width: 25, height: 25 }),
        );
      if (frame === 5) t.handles.root.remove(t.handles.a.id);
    });
  });

  it("notices a hand-placed layer that is given a layout, and the other way round", async () => {
    await sameAsAlwaysLayingOut(
      (tag) => {
        const root = new Group({ layout: { flexDirection: "row", gap: 6 } }, { id: `${tag}-row` });
        const placed = new Morph(
          { color: "#fff", size: { width: 30, height: 30 }, position: { x: 100, y: 50 } },
          { id: `${tag}-placed` },
        );
        root.add(box(`${tag}-flow`), placed);
        return { root, handles: { placed } };
      },
      (frame, t) => {
        if (frame === 3) t.handles.placed.props.layout = { width: 70, height: 20 };
        if (frame === 6) t.handles.placed.props.layout = undefined;
      },
    );
  });

  it("puts back a result that was written over, as a full pass would", async () => {
    await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 2) t.handles.a.props.position.x = 999;
      if (frame === 4) t.handles.b.props.size = { width: 5, height: 5 };
      if (frame === 6) t.handles.c.props.position = { x: -1, y: -1 };
    });
  });

  it("copes with the props of a laid-out layer being taken away", async () => {
    await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 2) t.handles.a.props.position = undefined;
      if (frame === 4) t.handles.b.props.size = undefined;
      if (frame === 6) t.handles.c.props.centring = "center";
    });
  });

  it("notices a layer swapped for another without being added or removed", async () => {
    await sameAsAlwaysLayingOut(row, (frame, t) => {
      if (frame === 3) {
        const tag = t.handles.root.id.split("-")[0];
        // Straight into the list: nothing announces it.
        t.handles.root.children.splice(1, 1, box(`${tag}-swapped`, { width: 77, height: 10 }));
      }
    });
  });

  it("keeps animating a layer that is laid out and has a signal on its size", async () => {
    await sameAsAlwaysLayingOut(
      (tag) => {
        const w = createSignal(40);
        const root = new Group({ layout: { flexDirection: "row" } }, { id: `${tag}-row` });
        const m = new Morph(
          { color: "#fff", size: { width: w, height: 20 }, layout: { height: 20 } },
          { id: `${tag}-m` },
        );
        root.add(m, box(`${tag}-b`));
        return { root, handles: { w } };
      },
      (frame, t) => t.handles.w.set(40 + frame * 7),
    );
  });

  it("asks for a new pass when the canvas is another size", async () => {
    const { root } = row("size");
    const scene = sceneFor({ root, handles: {} }, true);
    await scene.renderFrame(0);
    const layout = scene.lazyCanvas.manager.layout;
    const before = layout.stats.passes;
    layout.calculateLayout(root, 400, 300, scene.lazyCanvas.ctx, scene.lazyCanvas.canvas);
    expect(layout.stats.passes).toBe(before); // the same size: reused
    layout.calculateLayout(root, 200, 150, scene.lazyCanvas.ctx, scene.lazyCanvas.canvas);
    expect(layout.stats.passes).toBe(before + 1);
  });

  it("can be turned off", async () => {
    const stats = await sameAsAlwaysLayingOut(row, () => {}, 4);
    expect(stats.fresh).toEqual({ passes: 4, skipped: 0 });
  });

  it("gives the same result over a long run of random changes", async () => {
    // A small random generator, so that a failure can be repeated.
    let seed = 20240607;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const plan = Array.from({ length: 40 }, () => ({
      what: Math.floor(random() * 7),
      amount: Math.floor(random() * 60) + 5,
    }));

    await sameAsAlwaysLayingOut(
      (tag) => {
        const root = new Group(
          { layout: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 4 } },
          { id: `${tag}-row` },
        );
        const text = createSignal("text");
        const kids = [
          box(`${tag}-1`),
          box(`${tag}-2`, { width: 30, height: 30 }),
          label(`${tag}-3`, text),
          box(`${tag}-4`, { width: 50, height: 20, flexGrow: 1 }),
        ];
        root.add(...kids);
        return { root, handles: { root, kids, text } };
      },
      (frame, t) => {
        const step = plan[frame];
        const kid = t.handles.kids[frame % 4];
        switch (step.what) {
          case 0:
            kid.props.layout = { ...kid.props.layout, width: step.amount };
            break;
          case 1:
            t.handles.root.props.layout.gap = step.amount / 4;
            break;
          case 2:
            t.handles.text.set("x".repeat(step.amount / 3));
            break;
          case 3:
            t.handles.root.props.layout.flexDirection = step.amount % 2 ? "row" : "column";
            break;
          default:
            break; // most frames change nothing
        }
      },
      40,
    );
  });
});

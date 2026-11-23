import { NodeCanvasAdapter } from "@nmmty/adapter-node";
import {
  Easing,
  Group,
  LazyError,
  Matrix,
  Morph,
  Polygon,
  Scene,
  type Signal,
  Text,
  ThreadScheduler,
  Transform,
  Vector2,
  chain,
  createSignal,
  durationOf,
  stagger,
  staggerDelays,
  timeline,
} from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

const adapter = new NodeCanvasAdapter();

/** A scene with the given root layers; the canvas is 100 × 100. */
function sceneOf(options: ConstructorParameters<typeof Scene>[2] = {}, ...layers: any[]) {
  const scene = new Scene(100, 100, { adapter, ...options });
  scene.load(new Group({}).add(...layers));
  return scene;
}

/** A 20 × 20 red square at (40, 40). */
const square = (transform?: any, extra: Record<string, unknown> = {}) =>
  new Morph({
    color: "#ff0000",
    size: { width: 20, height: 20 },
    position: { x: 40, y: 40 },
    centring: "none",
    transform,
    ...extra,
  } as any);

/** Alpha of one pixel of the last frame. */
function alphaAt(scene: Scene, x: number, y: number): number {
  return scene.getImageData()[(y * scene.width + x) * 4 + 3];
}

describe("Vector2", () => {
  it("does the arithmetic and leaves the originals alone", () => {
    const a = new Vector2(3, 4);
    const b = new Vector2(1, 2);
    expect(a.add(b)).toEqual(new Vector2(4, 6));
    expect(a.sub(b)).toEqual(new Vector2(2, 2));
    expect(a.mul(2)).toEqual(new Vector2(6, 8));
    expect(a.mul({ x: 2, y: 0.5 })).toEqual(new Vector2(6, 2));
    expect(a.div(2)).toEqual(new Vector2(1.5, 2));
    expect(a.negate()).toEqual(new Vector2(-3, -4));
    expect(a.dot(b)).toBe(11);
    expect(a.cross(b)).toBe(2);
    expect(a.length).toBe(5);
    expect(a.normalize().length).toBeCloseTo(1, 12);
    expect(a.distanceTo(b)).toBeCloseTo(Math.hypot(2, 2), 12);
    expect(a).toEqual(new Vector2(3, 4));
  });

  it("converts to and from angles", () => {
    const v = Vector2.fromPolar(10, 90);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(10, 12);
    expect(v.angle).toBeCloseTo(90, 9);
    expect(new Vector2(1, 0).rotate(90).equals(new Vector2(0, 1), 1e-12)).toBe(true);
    expect(Vector2.zero.normalize()).toEqual(Vector2.zero);
  });

  it("is blended as a vector by a signal, and stays a Vector2", () => {
    const point = createSignal(new Vector2(0, 0));
    const scheduler = new ThreadScheduler();
    scheduler.add(point.to(new Vector2(100, 50), 1));
    scheduler.update(0);
    scheduler.update(0.5);
    expect(point.value()).toBeInstanceOf(Vector2);
    expect(point.value().x).toBeCloseTo(50, 5);
    expect(point.value().y).toBeCloseTo(25, 5);
  });
});

describe("Matrix", () => {
  it("applies the inner matrix first", () => {
    const m = Matrix.translation(10, 0).multiply(Matrix.scaling(2));
    expect(m.apply({ x: 1, y: 1 })).toEqual(new Vector2(12, 2));
    const turned = Matrix.rotation(90).apply({ x: 1, y: 0 });
    expect(turned.equals({ x: 0, y: 1 }, 1e-12)).toBe(true);
  });

  it("is undone by its inverse", () => {
    const m = Matrix.translation(5, -3)
      .multiply(Matrix.rotation(33))
      .multiply(Matrix.scaling(2, 0.5));
    const p = { x: 7, y: 11 };
    expect(m.inverse().apply(m.apply(p)).equals(p, 1e-9)).toBe(true);
    expect(m.multiply(m.inverse()).equals(Matrix.identity(), 1e-9)).toBe(true);
  });

  it("cannot invert a matrix that flattens space", () => {
    const flat = Matrix.scaling(0, 1);
    expect(flat.invertible).toBe(false);
    expect(() => flat.inverse()).toThrow(LazyError);
  });

  it("splits into parts and back for rotations, shears and mirrors", () => {
    const cases = [
      Matrix.compose({ translate: new Vector2(10, 20), rotate: 30, scale: new Vector2(2, 3) }),
      Matrix.compose({ rotate: -120, skew: 25, scale: new Vector2(1.5, 0.5) }),
      Matrix.compose({ rotate: 10, scale: new Vector2(-2, 1) }),
      Matrix.compose({ rotate: 200, skew: -40, scale: new Vector2(1, -2) }),
      new Matrix(1, 2, 3, 4, 5, 6),
    ];
    for (const m of cases) {
      const parts = m.decompose();
      expect(Matrix.compose(parts).equals(m, 1e-9), JSON.stringify(m)).toBe(true);
    }
  });

  it("reads the parts it was built from", () => {
    const parts = Matrix.compose({
      translate: new Vector2(4, 5),
      rotate: 40,
      scale: new Vector2(2, 3),
    }).decompose();
    expect(parts.rotate).toBeCloseTo(40, 9);
    expect(parts.scale.x).toBeCloseTo(2, 9);
    expect(parts.scale.y).toBeCloseTo(3, 9);
    expect(parts.skew).toBeCloseTo(0, 9);
  });

  it("blends a turn without shrinking in the middle", () => {
    const half = Matrix.identity().lerp(Matrix.rotation(180), 0.5);
    expect(half.determinant).toBeCloseTo(1, 9); // a straight blend of the six numbers gives 0
    expect(half.equals(Matrix.rotation(90), 1e-9)).toBe(true);
  });

  it("reads DOMMatrix-style names", () => {
    expect(Matrix.from({ m11: 2, m22: 3, m41: 4, m42: 5 }).toArray()).toEqual([2, 0, 0, 3, 4, 5]);
  });
});

describe("Transform", () => {
  it("accepts plain objects and keeps what it was given", () => {
    const t = Transform.from({ rotate: 30, scale: 2 });
    expect(t).toBeInstanceOf(Transform);
    expect(t.toJSON()).toEqual({ rotate: 30, scale: { x: 2, y: 2 } });
    expect(Transform.from(t)).toBe(t);
    expect(Transform.identity().toJSON()).toEqual({});
  });

  it("copies with changes", () => {
    const t = new Transform({ rotate: 10, origin: "center" }).with({ scale: 2 });
    expect(t.resolved().rotate).toBe(10);
    expect(t.resolved().scale).toEqual({ x: 2, y: 2 });
    expect(t.origin).toBe("center");
  });

  it("keeps the old rules without an origin: rotate around the centre, scale from the corner", () => {
    const box = { x: 40, y: 40, width: 20, height: 20 };
    const m = new Transform({ rotate: 90, scale: 2 }).toMatrix(box);
    // Scale from (0, 0) happens first (innermost), then the turn around the centre of the box.
    const turned = Matrix.translation(50, 50)
      .multiply(Matrix.rotation(90))
      .multiply(Matrix.translation(-50, -50))
      .multiply(Matrix.scaling(2));
    expect(m.equals(turned, 1e-9)).toBe(true);
  });

  it("pivots everything around the origin once it is set", () => {
    const box = { x: 40, y: 40, width: 20, height: 20 };
    const corner = new Transform({ scale: 2, origin: "top-left" }).toMatrix(box);
    expect(corner.apply({ x: 40, y: 40 })).toEqual(new Vector2(40, 40)); // the pivot stays put
    expect(corner.apply({ x: 60, y: 60 })).toEqual(new Vector2(80, 80));

    const centre = new Transform({ rotate: 180, origin: "center" }).toMatrix(box);
    expect(centre.apply({ x: 40, y: 40 }).equals({ x: 60, y: 60 }, 1e-9)).toBe(true);
  });

  it("reads origins in keywords, pixels and percent", () => {
    const box = { x: 100, y: 50, width: 40, height: 20 };
    expect(Transform.pivotOf("bottom-right", box)).toEqual(new Vector2(140, 70));
    expect(Transform.pivotOf("top", box)).toEqual(new Vector2(120, 50));
    expect(Transform.pivotOf({ x: 10, y: 5 }, box)).toEqual(new Vector2(110, 55));
    expect(Transform.pivotOf({ x: "25%", y: "50%" }, box)).toEqual(new Vector2(110, 60));
    expect(() => Transform.pivotOf("middle" as any, box)).toThrow(/Unknown transform origin/);
  });

  it("skews", () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const m = new Transform({ skew: { x: 45, y: 0 }, origin: "top-left" }).toMatrix(box);
    expect(m.apply({ x: 0, y: 10 }).equals({ x: 10, y: 10 }, 1e-9)).toBe(true);
    expect(m.apply({ x: 0, y: 0 })).toEqual(new Vector2(0, 0));
  });

  it("applies the matrix last, in the layer's coordinates", () => {
    const m = new Transform({
      translate: { x: 100, y: 0 },
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 0 },
    }).toMatrix();
    expect(m.apply({ x: 0, y: 0 })).toEqual(new Vector2(105, 0));
  });

  it("rejects a matrix that is missing numbers", () => {
    expect(() => new Transform({ matrix: { a: 1, b: 0, c: 0, d: 1 } as any }).resolved()).toThrow(
      /valid matrix/,
    );
  });

  it("blends field by field, and a matrix through its parts", () => {
    const a = new Transform({ rotate: 0, scale: 1, translate: { x: 0, y: 0 } });
    const b = new Transform({ rotate: 360, scale: 3, translate: { x: 100, y: 50 } });
    const half = a.lerp(b, 0.5).resolved();
    expect(half.rotate).toBe(180);
    expect(half.scale).toEqual({ x: 2, y: 2 });
    expect(half.translate).toEqual({ x: 50, y: 25 });

    const turn = new Transform({ matrix: Matrix.identity() }).lerp(
      new Transform({ matrix: Matrix.rotation(180) }),
      0.5,
    );
    expect(turn.resolved().matrix?.determinant).toBeCloseTo(1, 9);
  });

  it("animates as a whole when it is in a signal", () => {
    const signal = createSignal(new Transform({ rotate: 0, origin: "center" }));
    const scheduler = new ThreadScheduler();
    scheduler.add(signal.to(new Transform({ rotate: 90, scale: 2, origin: "center" }), 1));
    scheduler.update(0);
    scheduler.update(0.5);
    expect(signal.value()).toBeInstanceOf(Transform);
    expect(signal.value().resolved().rotate).toBeCloseTo(45, 5);
    expect(signal.value().resolved().scale.x).toBeCloseTo(1.5, 5);
    scheduler.update(1);
    expect(signal.value().resolved().rotate).toBe(90);
  });

  it("drives a layer from signals inside it, and from a signal of the whole thing", async () => {
    const angle = createSignal(0);
    const box = square(new Transform({ rotate: angle, origin: "center" }));
    const scene = sceneOf({}, box);
    scene.addAnimation(angle.to(90, 1));
    await scene.renderFrame(0.5);
    expect(box.worldMatrix().decompose().rotate).toBeCloseTo(45, 4);

    const whole = createSignal(new Transform({ rotate: 0, origin: "center" }));
    const other = square(whole);
    const scene2 = sceneOf({}, other);
    scene2.addAnimation(whole.to(new Transform({ rotate: 60, origin: "center" }), 1));
    await scene2.renderFrame(0.5);
    expect(other.worldMatrix().decompose().rotate).toBeCloseTo(30, 4);
  });

  it("keeps its signals when one transform is given to two layers", async () => {
    const angle = createSignal(0);
    const shared = new Transform({ rotate: angle, origin: "center" });
    const first = square(shared);
    const second = square(shared);
    const scene = sceneOf({}, first, second);
    scene.addAnimation(angle.to(80, 1));
    await scene.renderFrame(0.5);
    expect(first.worldMatrix().decompose().rotate).toBeCloseTo(40, 4);
    expect(second.worldMatrix().decompose().rotate).toBeCloseTo(40, 4);
  });

  it("can be scrubbed", async () => {
    const play = async (times: number[]) => {
      const angle = createSignal(0);
      const box = square(new Transform({ rotate: angle, origin: "center" }));
      const scene = sceneOf({}, box);
      scene.addAnimation(angle.spring(120, "wobbly"));
      const seen: number[] = [];
      for (const t of times) {
        await scene.renderFrame(t);
        seen.push(box.worldMatrix().decompose().rotate);
      }
      return seen;
    };
    const forward = await play([0.2, 1]);
    const scrubbed = await play([2, 1, 0.2]);
    expect(scrubbed[1]).toBeCloseTo(forward[1], 6);
    expect(scrubbed[2]).toBeCloseTo(forward[0], 6);
    expect(forward[0]).toBeGreaterThan(0);
  });

  it("is set with the layer's setters without losing the rest", () => {
    const box = square({ rotate: 10 });
    box.setScale(2, 3).setSkew(5).setOrigin("top-left").setTranslate(1, 2);
    const t = Transform.from(box.props.transform as any).toJSON();
    expect(t).toEqual({
      rotate: 10,
      scale: { x: 2, y: 3 },
      skew: { x: 5, y: 0 },
      origin: "top-left",
      translate: { x: 1, y: 2 },
    });
    box.setTransform(new Transform({ rotate: 1 }));
    expect(Transform.from(box.props.transform as any).toJSON()).toEqual({ rotate: 1 });
  });
});

describe("transforms on a canvas", () => {
  it("rotates around the origin that was asked for", async () => {
    const scene = sceneOf({}, square({ rotate: 90, origin: "top-left" }));
    await scene.renderFrame(0);
    // The 20 × 20 box at (40, 40) turns clockwise around its corner into x 20…40, y 40…60.
    expect(alphaAt(scene, 30, 50)).toBe(255);
    expect(alphaAt(scene, 50, 50)).toBe(0);
  });

  it("scales from the layer's corner when asked, and from the canvas corner as before otherwise", async () => {
    const legacy = sceneOf({}, square({ scale: 2 }));
    await legacy.renderFrame(0);
    expect(alphaAt(legacy, 90, 90)).toBe(255); // moved: (40…60) × 2 = 80…120
    expect(alphaAt(legacy, 50, 50)).toBe(0);

    const pinned = sceneOf({}, square({ scale: 2, origin: "top-left" }));
    await pinned.renderFrame(0);
    expect(alphaAt(pinned, 50, 50)).toBe(255); // grew from (40, 40) to 80, 80
    expect(alphaAt(pinned, 75, 75)).toBe(255);
    expect(alphaAt(pinned, 85, 85)).toBe(0);
  });

  it("draws a polygon with a transform, which it ignored before", async () => {
    const poly = new Polygon({
      color: "#00ff00",
      size: { width: 20, height: 20, count: 4, radius: 0 },
      position: { x: 40, y: 40 },
      centring: "none",
      transform: { translate: { x: 30, y: 0 } },
    } as any);
    const scene = sceneOf({}, poly);
    await scene.renderFrame(0);
    expect(poly.worldCorners()[0].x).toBe(70); // the box starts at 40, moved by 30
    expect(alphaAt(scene, 80, 50)).toBe(255);
  });

  it("applies a group's transform to everything in it", async () => {
    const child = square();
    const group = new Group({
      position: { x: 0, y: 0 },
      transform: { translate: { x: 20, y: 0 } },
    } as any).add(child);
    const scene = new Scene(100, 100, { adapter });
    scene.load(group);
    await scene.renderFrame(0);
    expect(child.worldCorners()[0].equals({ x: 60, y: 40 }, 1e-9)).toBe(true);
  });
});

describe("where a layer is", () => {
  it("is unknown until the layer has been drawn", async () => {
    const box = square();
    const scene = sceneOf({}, box);
    expect(box.isDrawn()).toBe(false);
    expect(() => box.worldMatrix()).toThrow(/not been drawn/);
    await scene.renderFrame(0);
    expect(box.isDrawn()).toBe(true);
  });

  it("reports the box, corners and bounds on the canvas", async () => {
    const box = square({ rotate: 90, origin: "center" });
    const scene = sceneOf({}, box);
    await scene.renderFrame(0);

    expect(box.bounds()).toEqual({ x: 40, y: 40, width: 20, height: 20 });
    const [topLeft, topRight] = box.worldCorners();
    expect(topLeft.equals({ x: 60, y: 40 }, 1e-9)).toBe(true); // a quarter turn moves the corner
    expect(topRight.equals({ x: 60, y: 60 }, 1e-9)).toBe(true);
    const bounds = box.worldBounds();
    expect(bounds.x).toBeCloseTo(40, 9);
    expect(bounds.width).toBeCloseTo(20, 9);
  });

  it("goes through every parent: a child of a group that was moved", async () => {
    const child = square();
    const group = new Group({ transform: { translate: { x: 10, y: 5 } } } as any).add(child);
    const scene = new Scene(100, 100, { adapter });
    scene.load(group);
    await scene.renderFrame(0);
    expect(child.localToWorld({ x: 40, y: 40 }).equals({ x: 50, y: 45 }, 1e-9)).toBe(true);
    expect(child.worldToLocal({ x: 50, y: 45 }).equals({ x: 40, y: 40 }, 1e-9)).toBe(true);
  });

  it("tells whether a point is on a turned layer, where it really is", async () => {
    const box = new Morph({
      color: "#f00",
      size: { width: 40, height: 10 },
      position: { x: 30, y: 45 },
      centring: "none",
      transform: { rotate: 90, origin: "center" },
    } as any);
    const scene = sceneOf({}, box);
    await scene.renderFrame(0);
    // Turned a quarter, the wide bar stands up: x 45…55, y 30…70.
    expect(box.contains({ x: 50, y: 32 })).toBe(true);
    expect(box.contains({ x: 33, y: 50 })).toBe(false);
  });

  it("finds the top-most layer under a point", async () => {
    const below = square(undefined, { id: "below" });
    const above = new Morph({
      id: "above",
      color: "#00f",
      size: { width: 20, height: 20 },
      position: { x: 50, y: 50 },
      centring: "none",
    } as any);
    const scene = sceneOf({}, below, above);
    await scene.renderFrame(0);

    expect(scene.layerAt({ x: 55, y: 55 })?.id).toBe("above");
    expect(scene.layersAt({ x: 55, y: 55 }).map((l) => l.id)).toEqual(["above", "below"]);
    expect(scene.layerAt({ x: 45, y: 45 })?.id).toBe("below");
    expect(scene.layerAt({ x: 5, y: 5 })).toBeUndefined();
  });

  it("skips hidden layers when looking for what is under a point", async () => {
    const box = square(undefined, { id: "ghost" });
    box.setVisible(false);
    const scene = sceneOf({}, box);
    await scene.renderFrame(0);
    expect(scene.layerAt({ x: 50, y: 50 })).toBeUndefined();
  });

  it("is known for a layer drawn through the cache too", async () => {
    const box = square({ rotate: 45, origin: "center" });
    const scene = sceneOf({ cache: true }, box);
    await scene.renderFrame(0);
    expect(box.isDrawn()).toBe(true);
    expect(box.worldMatrix().decompose().rotate).toBeCloseTo(45, 6);
    await scene.renderFrame(0); // a cache hit keeps what it had
    expect(box.worldMatrix().decompose().rotate).toBeCloseTo(45, 6);
  });
});

describe("text with a pivot", () => {
  it("turns around the middle of the line, whatever its alignment", async () => {
    const make = (align: "left" | "center" | "right") =>
      new Text({
        text: "LazyCanvas",
        color: "#ffffff",
        font: { family: "Geist", size: 28, weight: 700 },
        position: { x: 50, y: 50 },
        align,
        centring: "none",
        transform: { rotate: 180, origin: "center" },
      } as any);

    for (const align of ["left", "center", "right"] as const) {
      const text = make(align);
      const scene = sceneOf({}, text);
      await scene.renderFrame(0);
      const box = text.bounds();
      expect(box.width, align).toBeGreaterThan(40);
      expect(box.height, align).toBeGreaterThan(20);
      // A half turn around the middle of the box maps the box onto itself.
      const world = text.worldBounds();
      expect(world.x).toBeCloseTo(box.x, 4);
      expect(world.width).toBeCloseTo(box.width, 4);
    }
  });

  it("keeps the old behaviour when there is no origin", async () => {
    const text = new Text({
      text: "LazyCanvas",
      color: "#ffffff",
      font: { family: "Geist", size: 28, weight: 700 },
      position: { x: 50, y: 50 },
      align: "center",
      centring: "none",
      transform: { rotate: 90 },
    } as any);
    const scene = sceneOf({}, text);
    await scene.renderFrame(0);
    // Rotation around the anchor point (50, 50) for centred text.
    expect(text.worldMatrix().apply({ x: 50, y: 50 }).equals({ x: 50, y: 50 }, 1e-9)).toBe(true);
  });
});

describe("stagger", () => {
  it("spaces items by `each`, from the start by default", () => {
    expect(staggerDelays(4, 0.1).map((d) => Math.round(d * 1000) / 1000)).toEqual([
      0, 0.1, 0.2, 0.3,
    ]);
  });

  it("starts from the end, the centre, the edges or an index", () => {
    const round = (values: number[]) => values.map((d) => Math.round(d * 1000) / 1000);
    expect(round(staggerDelays(4, { each: 0.1, from: "end" }))).toEqual([0.3, 0.2, 0.1, 0]);
    expect(round(staggerDelays(5, { each: 0.1, from: "center" }))).toEqual([0.2, 0.1, 0, 0.1, 0.2]);
    expect(round(staggerDelays(4, { each: 0.1, from: "center" }))).toEqual([
      0.15, 0.05, 0.05, 0.15,
    ]);
    expect(round(staggerDelays(5, { each: 0.1, from: "edges" }))).toEqual([0, 0.1, 0.2, 0.1, 0]);
    expect(round(staggerDelays(5, { each: 0.1, from: 1 }))).toEqual([0.1, 0, 0.1, 0.2, 0.3]);
  });

  it("spreads over `total` instead", () => {
    const delays = staggerDelays(5, { total: 2 });
    expect(delays[0]).toBe(0);
    expect(delays[4]).toBeCloseTo(2, 9);
    expect(delays[2]).toBeCloseTo(1, 9);
  });

  it("reshapes the spacing with an easing", () => {
    const delays = staggerDelays(5, { total: 1, ease: Easing.easeIn });
    expect(delays[2]).toBeCloseTo(0.25, 9); // easeIn(0.5)
    expect(delays[4]).toBeCloseTo(1, 9);
  });

  it("shuffles the same way for the same seed, and differently for another", () => {
    const a = staggerDelays(8, { each: 1, from: "random", seed: 7 });
    expect(staggerDelays(8, { each: 1, from: "random", seed: 7 })).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // every slot used once
    expect(staggerDelays(8, { each: 1, from: "random", seed: 8 })).not.toEqual(a);
  });

  it("rejects options that mean nothing", () => {
    expect(() => staggerDelays(3, {})).toThrow(/each/);
    expect(() => staggerDelays(3, -1)).toThrow(/negative/);
    expect(() => staggerDelays(3, { each: 1, from: 9 })).toThrow(/outside/);
    expect(staggerDelays(0, 1)).toEqual([]);
    expect(staggerDelays(1, 1)).toEqual([0]);
  });

  it("starts each animation a little after the one before", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const c = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(stagger(0.5, [a.to(10, 1), b.to(10, 1), c.to(10, 1)]));
    scheduler.update(0);
    scheduler.update(0.5);
    expect([a.value(), b.value(), c.value()].map((v) => Math.round(v * 100) / 100)).toEqual([
      5, 0, 0,
    ]);
    scheduler.update(1);
    expect([a.value(), b.value(), c.value()].map((v) => Math.round(v * 100) / 100)).toEqual([
      10, 5, 0,
    ]);
    scheduler.update(2);
    expect([a.value(), b.value(), c.value()]).toEqual([10, 10, 10]);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("makes the animation for each item", () => {
    const signals: Signal<number>[] = [createSignal(0), createSignal(0), createSignal(0)];
    const scheduler = new ThreadScheduler();
    scheduler.add(stagger({ each: 1, from: "end" }, signals, (s, i) => s.to(i + 1, 1)));
    scheduler.update(0);
    scheduler.update(1);
    expect(signals[2].value()).toBe(3); // the last item goes first
    expect(signals[0].value()).toBe(0);
    scheduler.update(3);
    expect(signals.map((s) => s.value())).toEqual([1, 2, 3]);
  });

  it("knows how long it takes, and works in a timeline and a chain", () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const s = stagger(0.25, [a.to(1, 1), b.to(1, 2)]);
    expect(durationOf(s)).toBe(2.25);
    expect(durationOf(chain(s, a.to(0, 1)))).toBe(3.25);

    const tl = timeline()
      .add(stagger(0.5, [a.to(1, 1), b.to(1, 1)]))
      .add(a.to(5, 1));
    expect(tl.duration).toBe(2.5);
  });

  it("with nothing to animate finishes at once", () => {
    const scheduler = new ThreadScheduler();
    scheduler.add(stagger(1, []));
    scheduler.update(0);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });
});

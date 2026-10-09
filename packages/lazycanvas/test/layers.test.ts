import {
  Centring,
  Group,
  LayersManager,
  MorphLayer,
  findLayer,
  getChildren,
  walkLayers,
} from "@nmmty/lazycanvas";
import { beforeEach, describe, expect, it } from "vitest";

const morph = (id: string, zIndex = 1) =>
  new MorphLayer(
    { color: "#ffffff", size: { width: 10, height: 10 }, centring: Centring.None },
    { id, zIndex },
  );

describe("tree helpers", () => {
  it("getChildren reads Group.layers and a layer's children alike", () => {
    const child = morph("child");
    const div = new Group({}, { id: "div" }).add(child);
    expect(getChildren(div)).toEqual([child]);

    const parent = morph("parent");
    parent.add(child);
    expect(getChildren(parent)).toEqual([child]);

    expect(getChildren(morph("leaf"))).toEqual([]);
  });

  it("walkLayers visits parents before children, depth first", () => {
    const leaf = morph("leaf");
    const inner = new Group({}, { id: "inner" }).add(leaf);
    const outer = new Group({}, { id: "outer" }).add(inner, morph("sibling"));

    expect([...walkLayers(outer)].map((l) => l.id)).toEqual(["outer", "inner", "leaf", "sibling"]);
  });

  it("findLayer reaches arbitrarily deep nodes", () => {
    const deep = morph("deep");
    const tree = new Group({}, { id: "a" }).add(
      new Group({}, { id: "b" }).add(new Group({}, { id: "c" }).add(deep)),
    );
    expect(findLayer(tree, "deep")).toBe(deep);
    expect(findLayer(tree, "nope")).toBeUndefined();
  });
});

describe("LayersManager", () => {
  let manager: LayersManager;

  beforeEach(() => {
    manager = new LayersManager();
  });

  it("rejects duplicate ids", () => {
    manager.add(morph("dup"));
    expect(() => manager.add(morph("dup"))).toThrow(/already exists/i);
  });

  it("keeps layers ordered by zIndex", () => {
    manager.add(morph("c", 3), morph("a", 1), morph("b", 2));
    expect(manager.toArray().map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("get() without cross search only sees the top level", () => {
    const deep = morph("deep");
    manager.add(new Group({}, { id: "group" }).add(deep));
    expect(manager.get("deep")).toBeUndefined();
  });

  it("get(id, true) finds nested layers at any depth", () => {
    const deep = morph("deep");
    manager.add(new Group({}, { id: "outer" }).add(new Group({}, { id: "inner" }).add(deep)));
    expect(manager.get("deep", true)).toBe(deep);
  });

  it("removes and clears", () => {
    manager.add(morph("x"), morph("y"));
    manager.remove("x");
    expect(manager.size()).toBe(1);
    expect(manager.has("x")).toBe(false);
    manager.clear();
    expect(manager.size()).toBe(0);
  });

  it("round-trips through an array", () => {
    manager.add(morph("a"), morph("b"));
    const arr = manager.toArray();
    const other = new LayersManager().fromArray(arr);
    expect(other.toArray().map((l) => l.id)).toEqual(["a", "b"]);
  });
});

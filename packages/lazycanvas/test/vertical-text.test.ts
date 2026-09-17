import { canvasDirection, isVerticalDirection, layoutVerticalText } from "@nmmty/lazycanvas";
import { describe, expect, it } from "vitest";

/** Every unit is 10 wide, so coordinates are easy to reason about. */
const fixed = (_t: string) => 10;
/** Width proportional to length, for testing column widths and centring. */
const byLength = (t: string) => t.length * 10;

const base = {
  direction: "ttb" as const,
  mode: "words" as const,
  columnDirection: "rl" as const,
  lineHeight: 20,
  maxHeight: 0,
  measure: fixed,
};

describe("direction helpers", () => {
  it("recognises the vertical directions", () => {
    expect(isVerticalDirection("ttb")).toBe(true);
    expect(isVerticalDirection("btt")).toBe(true);
    expect(isVerticalDirection("ltr")).toBe(false);
    expect(isVerticalDirection("rtl")).toBe(false);
    expect(isVerticalDirection(undefined)).toBe(false);
  });

  it("only passes directions the canvas understands", () => {
    // Assigning "ttb" to ctx.direction is ignored by some engines and throws in
    // others, so it must never reach the context.
    expect(canvasDirection("ltr")).toBe("ltr");
    expect(canvasDirection("rtl")).toBe("rtl");
    expect(canvasDirection("inherit")).toBe("inherit");
    expect(canvasDirection("ttb")).toBeUndefined();
    expect(canvasDirection("btt")).toBeUndefined();
  });
});

describe("layoutVerticalText — words mode", () => {
  it("stacks whole words downward, one per slot", () => {
    const l = layoutVerticalText({ ...base, text: "Привет как дела" });

    expect(l.units.map((u) => u.text)).toEqual(["Привет", "как", "дела"]);
    expect(l.units.map((u) => u.y)).toEqual([0, 20, 40]);
    expect(l.columns).toBe(1);
    expect(l.height).toBe(60);
  });

  it("btt puts the first word at the bottom of the same box", () => {
    const ttb = layoutVerticalText({ ...base, text: "one two three" });
    const btt = layoutVerticalText({ ...base, direction: "btt", text: "one two three" });

    expect(btt.units.map((u) => u.text)).toEqual(["one", "two", "three"]);
    expect(btt.units.map((u) => u.y)).toEqual([40, 20, 0]);
    // Both directions occupy the same rectangle; only reading order differs.
    expect(btt.height).toBe(ttb.height);
    expect(btt.width).toBe(ttb.width);
  });

  it("collapses runs of whitespace and reports each word's offset", () => {
    const l = layoutVerticalText({ ...base, text: "aa   bb\tcc" });
    expect(l.units.map((u) => u.text)).toEqual(["aa", "bb", "cc"]);
    expect(l.units.map((u) => u.startOffset)).toEqual([0, 5, 8]);
  });

  it("centres each word across its column", () => {
    const l = layoutVerticalText({ ...base, measure: byLength, text: "aaaa b" });
    expect(l.width).toBe(40);
    // "aaaa" fills the column, "b" is centred in it.
    expect(l.units[0].x).toBe(0);
    expect(l.units[1].x).toBe(15);
  });
});

describe("layoutVerticalText — ideographs mode", () => {
  it("puts one character per slot", () => {
    const l = layoutVerticalText({ ...base, mode: "ideographs", text: "日本語" });
    expect(l.units.map((u) => u.text)).toEqual(["日", "本", "語"]);
    expect(l.units.map((u) => u.y)).toEqual([0, 20, 40]);
  });

  it("keeps a grapheme cluster whole rather than splitting code units", () => {
    // A flag and a ZWJ family are each one grapheme but several code points;
    // splitting by code unit would render them as broken fragments.
    const l = layoutVerticalText({ ...base, mode: "ideographs", text: "🇯🇵👩‍👩‍👧" });
    expect(l.units.map((u) => u.text)).toEqual(["🇯🇵", "👩‍👩‍👧"]);
  });

  it("counts spaces as slots", () => {
    const l = layoutVerticalText({ ...base, mode: "ideographs", text: "a b" });
    expect(l.units.map((u) => u.text)).toEqual(["a", " ", "b"]);
  });
});

describe("layoutVerticalText — columns", () => {
  const wrapping = { ...base, mode: "ideographs" as const, maxHeight: 60, text: "abcdefgh" };

  it("wraps once a column is full", () => {
    const l = layoutVerticalText(wrapping);
    // 60 / 20 = three slots per column, eight characters -> three columns.
    expect(l.columns).toBe(3);
    expect(l.height).toBe(60);
    expect(l.units.filter((u) => u.column === 0).map((u) => u.text)).toEqual(["a", "b", "c"]);
    expect(l.units.filter((u) => u.column === 2).map((u) => u.text)).toEqual(["g", "h"]);
  });

  it("rl puts the first column on the right", () => {
    const l = layoutVerticalText({ ...wrapping, columnDirection: "rl" });
    const first = l.units.find((u) => u.column === 0)!;
    const last = l.units.find((u) => u.column === 2)!;
    expect(first.x).toBeGreaterThan(last.x);
  });

  it("lr puts the first column on the left", () => {
    const l = layoutVerticalText({ ...wrapping, columnDirection: "lr" });
    const first = l.units.find((u) => u.column === 0)!;
    const last = l.units.find((u) => u.column === 2)!;
    expect(first.x).toBeLessThan(last.x);
  });

  it("both column directions fill the same overall box", () => {
    const rl = layoutVerticalText({ ...wrapping, columnDirection: "rl" });
    const lr = layoutVerticalText({ ...wrapping, columnDirection: "lr" });
    expect(rl.width).toBe(lr.width);
    expect(rl.height).toBe(lr.height);
  });

  it("applies the column gap", () => {
    const tight = layoutVerticalText(wrapping);
    const spaced = layoutVerticalText({ ...wrapping, columnGap: 6 });
    expect(spaced.width).toBe(tight.width + 12);
  });

  it("does not wrap when no height limit is given", () => {
    const l = layoutVerticalText({ ...wrapping, maxHeight: 0 });
    expect(l.columns).toBe(1);
    expect(l.height).toBe(160);
  });

  it("always fits at least one unit per column", () => {
    const l = layoutVerticalText({ ...wrapping, maxHeight: 1 });
    expect(l.columns).toBe(8);
  });

  it("starts a new column at a newline", () => {
    const l = layoutVerticalText({ ...base, text: "one two\nthree" });
    expect(l.columns).toBe(2);
    expect(l.units.filter((u) => u.column === 1).map((u) => u.text)).toEqual(["three"]);
  });

  it("reports offsets across a newline", () => {
    const l = layoutVerticalText({ ...base, text: "ab\ncd" });
    expect(l.units.map((u) => u.startOffset)).toEqual([0, 3]);
  });
});

describe("layoutVerticalText — edge cases", () => {
  it("handles empty text", () => {
    const l = layoutVerticalText({ ...base, text: "" });
    expect(l).toEqual({ units: [], width: 0, height: 0, columns: 0 });
  });

  it("handles whitespace-only text in words mode", () => {
    expect(layoutVerticalText({ ...base, text: "   " }).units).toEqual([]);
  });
});

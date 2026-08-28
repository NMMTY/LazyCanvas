import { describe, expect, it } from "vitest";
import { Easing, Signal, createSignal, ThreadScheduler } from "@nmmty/lazycanvas";

describe("Easing", () => {
  const named = Object.entries(Easing);

  it("every easing is anchored at 0 and 1", () => {
    for (const [name, fn] of named) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });

  it("linear is the identity", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(Easing.linear(t)).toBe(t);
    }
  });

  it("easeIn starts slower than linear, easeOut starts faster", () => {
    expect(Easing.easeIn(0.25)).toBeLessThan(0.25);
    expect(Easing.easeOut(0.25)).toBeGreaterThan(0.25);
  });
});

describe("Signal", () => {
  it("reports its initial value", () => {
    const s = createSignal(10);
    expect(s.get(0)).toBe(10);
  });

  it("is a Signal instance", () => {
    expect(createSignal(1)).toBeInstanceOf(Signal);
  });

  it("tweens a number to its target over the given duration", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(s.to(100, 1, { easing: Easing.linear }));

    // The first update establishes the time base, so delta is 0.
    scheduler.update(0);
    expect(s.value()).toBe(0);

    scheduler.update(0.5);
    expect(s.value()).toBeGreaterThan(0);
    expect(s.value()).toBeLessThan(100);

    scheduler.update(1);
    expect(s.value()).toBe(100);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("interpolates colours", () => {
    const s = createSignal("#000000");
    const scheduler = new ThreadScheduler();
    scheduler.add(s.to("#ffffff", 1, { easing: Easing.linear }));
    scheduler.update(0);
    scheduler.update(0.5);
    const mid = s.value();
    expect(mid).not.toBe("#000000");
    expect(mid).not.toBe("#ffffff");
  });

  it("set() cancels a running animation", () => {
    const s = createSignal(0);
    const scheduler = new ThreadScheduler();
    scheduler.add(s.run(s.to(100, 1)).value === undefined ? s.to(100, 1) : s.to(100, 1));
    s.set(42);
    expect(s.value()).toBe(42);
    expect(s.isAnimating()).toBe(false);
  });

  it("reset() restores the initial value", () => {
    const s = createSignal(7);
    s.set(99);
    s.reset();
    expect(s.value()).toBe(7);
  });
});

describe("ThreadScheduler", () => {
  it("drops threads once they finish and reports activity", () => {
    const scheduler = new ThreadScheduler();
    function* short(): Generator<void, void, number | void> {
      yield;
    }
    scheduler.add(short());
    expect(scheduler.hasActiveThreads()).toBe(true);

    scheduler.update(0);
    scheduler.update(0.1);
    expect(scheduler.hasActiveThreads()).toBe(false);
  });

  it("resets its timeline", () => {
    const scheduler = new ThreadScheduler();
    scheduler.update(5);
    expect(scheduler.getTime()).toBe(5);
    scheduler.reset();
    expect(scheduler.getTime()).toBe(0);
  });
});

"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Easing, createSignal, loop, stagger, timeline } from "@nmmty/lazycanvas";
import { useMemo } from "react";

const COUNT = 7;

export default function TimelineExample() {
  const bars = useMemo(() => Array.from({ length: COUNT }, () => createSignal(10)), []);
  const dot = useMemo(() => createSignal(30), []);
  const glow = useMemo(() => createSignal(0.25), []);

  return (
    <Scene
      width={480}
      height={190}
      animated
      onReady={(scene) =>
        scene.addAnimation(() =>
          loop(function* () {
            // The bars drop one after the other, from the middle outwards...
            const rise = stagger({ each: 0.07, from: "center" }, bars, (h) =>
              h.to(120, 0.5, { easing: Easing.easeOutCubic }),
            );
            const fall = stagger({ each: 0.05, from: "center" }, bars, (h) => h.to(10, 0.4));

            // ...and a timeline places the rest relative to them: the dot starts with the first bar
            // ("<"), the glow 0.1 s before the bars are all up, and everything goes back after a label.
            const tl = timeline()
              .add(rise)
              .add(dot.to(440, 1), "<")
              .add(glow.to(1, 0.4), ">-=0.1")
              .label("down")
              .add(fall, "down+=0.3")
              .add(dot.to(30, 0.6), "down+=0.3")
              .add(glow.to(0.25, 0.4), "down+=0.3");
            yield* tl.play();
          }),
        )
      }
    >
      <Group>
        <Morph
          color="#0f172a"
          size={{ width: 480, height: 190, radius: { all: 16 } }}
          position={{ x: 0, y: 0 }}
          centring="none"
        />
        {bars.map((height, i) => (
          <Morph
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
            key={i}
            color="#6366f1"
            opacity={glow}
            size={{ width: 40, height, radius: { all: 8 } }}
            position={{ x: 40 + i * 58, y: 50 }}
            centring="none"
          />
        ))}
        <Morph
          color="#f59e0b"
          size={{ width: 16, height: 16, radius: { all: 8 } }}
          position={{ x: dot, y: 20 }}
          centring="none"
        />
      </Group>
    </Scene>
  );
}

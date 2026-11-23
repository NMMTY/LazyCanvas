"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Easing, all, createSignal, waitFor } from "@nmmty/lazycanvas";
import { useMemo } from "react";

export default function Springs() {
  const smooth = useMemo(() => createSignal(40), []);
  const bouncy = useMemo(() => createSignal(40), []);
  const keyed = useMemo(() => createSignal(40), []);

  return (
    <Scene
      width={480}
      height={180}
      animated
      onReady={(scene) =>
        scene.addAnimation(function* () {
          yield* all(
            smooth.spring(440),
            bouncy.spring(440, "wobbly"),
            keyed.keyframes([
              { at: 0, value: 40 },
              { at: 0.35, value: 300, easing: Easing.easeOutCubic },
              { at: 0.5, value: 260 },
              { at: 1.2, value: 440, easing: Easing.easeInOutCubic },
            ]),
          );
          yield* waitFor(0.4);
          yield* all(smooth.spring(40), bouncy.spring(40, "wobbly"), keyed.to(40, 0.8));
          yield* waitFor(0.4);
        })
      }
    >
      <Group>
        <Morph
          color="#0f172a"
          size={{ width: 480, height: 180, radius: { all: 16 } }}
          position={{ x: 0, y: 0 }}
          centring="none"
        />
        <Morph
          color="#22c55e"
          size={{ width: 28, height: 28, radius: { all: 8 } }}
          position={{ x: smooth, y: 36 }}
        />
        <Morph
          color="#f59e0b"
          size={{ width: 28, height: 28, radius: { all: 8 } }}
          position={{ x: bouncy, y: 90 }}
        />
        <Morph
          color="#3b82f6"
          size={{ width: 28, height: 28, radius: { all: 8 } }}
          position={{ x: keyed, y: 144 }}
        />
      </Group>
    </Scene>
  );
}

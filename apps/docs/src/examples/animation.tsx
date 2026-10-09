"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Easing, all, createSignal } from "@nmmty/lazycanvas";
import { useMemo } from "react";

export default function Animation() {
  // Signals hold animated values; layers read them on every frame.
  const x = useMemo(() => createSignal(40), []);
  const size = useMemo(() => createSignal(48), []);
  const color = useMemo(() => createSignal("#ef4444"), []);

  return (
    <Scene
      width={480}
      height={120}
      animated
      onReady={(scene) =>
        scene.addAnimation(function* () {
          yield* all(
            x.to(440, 1.2, { easing: Easing.easeInOutCubic }),
            color.to("#3b82f6", 1.2),
            size.to(72, 1.2, { easing: Easing.easeOutBack }),
          );
          yield* all(
            x.to(40, 1.2, { easing: Easing.easeInOutCubic }),
            color.to("#ef4444", 1.2),
            size.to(48, 1.2),
          );
        })
      }
    >
      <Group>
        <Morph
          color="#0f172a"
          size={{ width: 480, height: 120, radius: { all: 16 } }}
          position={{ x: 0, y: 0 }}
          centring="none"
        />
        <Morph
          color={color}
          size={{ width: size, height: size, radius: { all: 14 } }}
          position={{ x, y: 60 }}
        />
      </Group>
    </Scene>
  );
}

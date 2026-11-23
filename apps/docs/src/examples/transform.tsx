"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Transform, createSignal, loop } from "@nmmty/lazycanvas";
import { useMemo } from "react";

export default function TransformExample() {
  const turn = useMemo(() => createSignal(0), []);
  const pose = useMemo(
    () => createSignal(new Transform({ rotate: 0, scale: 1, skew: { x: 0, y: 0 }, origin: "center" })),
    [],
  );
  const box = { width: 90, height: 90, radius: { all: 14 } };

  return (
    <Scene
      width={520}
      height={170}
      animated
      onReady={(scene) =>
        scene.addAnimation(() =>
          loop(function* () {
            yield* turn.to(360, 2);
            yield* pose.to(new Transform({ rotate: 45, scale: 1.25, skew: { x: 12, y: 0 }, origin: "center" }), 0.8);
            yield* pose.spring(new Transform({ rotate: 0, scale: 1, skew: { x: 0, y: 0 }, origin: "center" }), "wobbly");
            turn.set(0);
          }),
        )
      }
    >
      <Group>
        <Morph color="#e2e8f0" size={{ width: 520, height: 170 }} position={{ x: 0, y: 0 }} centring="none" />
        {/* the same rotation around three different pivots */}
        <Morph
          color="#6366f1"
          size={box}
          position={{ x: 30, y: 40 }}
          centring="none"
          transform={new Transform({ rotate: turn, origin: "top-left" })}
        />
        <Morph
          color="#22c55e"
          size={box}
          position={{ x: 160, y: 40 }}
          centring="none"
          transform={new Transform({ rotate: turn, origin: "center" })}
        />
        <Morph
          color="#f59e0b"
          size={box}
          position={{ x: 290, y: 40 }}
          centring="none"
          transform={new Transform({ rotate: turn, origin: { x: "100%", y: "100%" } })}
        />
        {/* a whole transform as one animated value */}
        <Morph color="#ef4444" size={box} position={{ x: 420, y: 40 }} centring="none" transform={pose} />
      </Group>
    </Scene>
  );
}

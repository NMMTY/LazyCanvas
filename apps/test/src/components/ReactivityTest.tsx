"use client";

import { GEIST_MONO_FAMILY } from "@/app/fonts";
import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";
import { FontWeight } from "@nmmty/lazycanvas";
import { useState } from "react";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];

/**
 * Verifies that <Scene> re-renders the canvas when React state changes its
 * children. Before the effect dependencies were fixed the canvas stayed frozen
 * on the first frame no matter how often the state changed.
 */
export default function ReactivityTest() {
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState(120);

  const color = COLORS[index % COLORS.length];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
      <Scene width={400} height={200} autoRender>
        <Group layout={{ width: 400, height: 200, alignItems: "center", justifyContent: "center" }}>
          <Morph
            layout={{ position: "absolute", width: 400, height: 200 }}
            size={{ width: 400, height: 200, radius: { all: 12 } }}
            color="#0f172a"
          />
          <Morph
            layout={{ width: size, height: size }}
            size={{ width: size, height: size, radius: { all: 16 } }}
            color={color}
          />
          <Text
            layout={{ position: "absolute", left: 12, top: 12 }}
            text={`${color} · ${size}px`}
            font={{ family: GEIST_MONO_FAMILY, size: 14, weight: FontWeight.Regular }}
            color="#e2e8f0"
            align="left"
            baseline="top"
          />
        </Group>
      </Scene>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setIndex((i) => i + 1)}>
          Next color
        </button>
        <button type="button" onClick={() => setSize((s) => (s >= 160 ? 60 : s + 20))}>
          Grow
        </button>
      </div>
    </div>
  );
}

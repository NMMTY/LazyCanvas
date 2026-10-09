"use client";

import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";
import { useState } from "react";

export default function Reactive() {
  const [radius, setRadius] = useState(24);
  const [hue, setHue] = useState(260);
  const [label, setLabel] = useState("Edit me");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          radius {radius}{" "}
          <input type="range" min={0} max={70} value={radius} onChange={(e) => setRadius(+e.target.value)} />
        </label>
        <label>
          hue {hue}{" "}
          <input type="range" min={0} max={360} value={hue} onChange={(e) => setHue(+e.target.value)} />
        </label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <Scene width={480} height={160} style={{ maxWidth: "100%", height: "auto" }}>
        <Group layout={{ width: 480, height: 160, justifyContent: "center", alignItems: "center" }}>
          <Morph
            color={`hsl(${hue}, 80%, 55%)`}
            size={{ width: 480, height: 160, radius: { all: radius } }}
            layout={{ position: "absolute", top: 0, left: 0 }}
          />
          <Text
            text={label}
            color="#ffffff"
            font={{ family: "sans-serif", size: 36, weight: 700 }}
            align="center"
          />
        </Group>
      </Scene>
    </div>
  );
}

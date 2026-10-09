"use client";

import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";
import { useState } from "react";

const JUSTIFY = ["flex-start", "center", "flex-end", "space-between", "space-around"] as const;
const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];

export default function Layout() {
  const [justifyContent, setJustify] = useState<(typeof JUSTIFY)[number]>("space-between");
  const [flexDirection, setDirection] = useState<"row" | "column">("row");
  const [gap, setGap] = useState(12);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={justifyContent} onChange={(e) => setJustify(e.target.value as never)}>
          {JUSTIFY.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={flexDirection} onChange={(e) => setDirection(e.target.value as never)}>
          <option>row</option>
          <option>column</option>
        </select>
        <label>
          gap {gap}{" "}
          <input type="range" min={0} max={40} value={gap} onChange={(e) => setGap(+e.target.value)} />
        </label>
      </div>

      <Scene width={480} height={200} style={{ maxWidth: "100%", height: "auto" }}>
        <Group
          layout={{
            width: 480,
            height: 200,
            padding: 16,
            flexDirection,
            justifyContent,
            alignItems: "center",
            gap,
          }}
        >
          <Morph
            color="#1e293b"
            size={{ width: 480, height: 200, radius: { all: 16 } }}
            layout={{ position: "absolute", top: 0, left: 0 }}
          />
          {COLORS.map((color, index) => (
            <Morph
              key={color}
              color={color}
              size={{ width: 56, height: 56, radius: { all: 12 } }}
              layout={{ width: 56, height: 56 }}
            />
          ))}
        </Group>
      </Scene>
    </div>
  );
}

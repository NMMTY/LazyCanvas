"use client";

import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";

export default function TextExample() {
  return (
    <Scene width={520} height={260}>
      <Group>
        <Morph
          color="#0f172a"
          size={{ width: 520, height: 260 }}
          position={{ x: 0, y: 0 }}
          centring="none"
        />
        <Text
          text="Weights and sizes"
          color="#f8fafc"
          font={{ family: "sans-serif", size: 30, weight: 700 }}
          position={{ x: 20, y: 20 }}
          align="left"
          baseline="top"
        />
        <Text
          text="Highlight parts of a string"
          color="#94a3b8"
          subStringColors={[{ color: "#f472b6", start: 0, end: 9 }]}
          font={{ family: "sans-serif", size: 22, weight: 400 }}
          position={{ x: 20, y: 66 }}
          align="left"
          baseline="top"
        />
        <Text
          text="Spaced out"
          color="#38bdf8"
          letterSpacing={6}
          font={{ family: "sans-serif", size: 22, weight: 600 }}
          position={{ x: 20, y: 104 }}
          align="left"
          baseline="top"
        />
        <Text
          text="Long text wraps inside the box you give it, line after line."
          color="#e2e8f0"
          multiline={{ enabled: true, spacing: 1.3 }}
          size={{ width: 260, height: 100 }}
          font={{ family: "sans-serif", size: 18, weight: 400 }}
          position={{ x: 20, y: 150 }}
          align="left"
          baseline="top"
        />
        <Text
          text="Top to bottom"
          color="#fbbf24"
          direction="ttb"
          vertical={{ mode: "words", gap: 8 }}
          font={{ family: "sans-serif", size: 26, weight: 700 }}
          position={{ x: 440, y: 30 }}
          align="left"
          baseline="top"
        />
      </Group>
    </Scene>
  );
}

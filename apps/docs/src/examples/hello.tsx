"use client";

import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";

export default function Hello() {
  return (
    <Scene width={480} height={160}>
      <Group layout={{ width: 480, height: 160, justifyContent: "center", alignItems: "center" }}>
        {/* A background that ignores the flex flow */}
        <Morph
          color="#7c3aed"
          size={{ width: 480, height: 160, radius: { all: 24 } }}
          layout={{ position: "absolute", top: 0, left: 0 }}
        />
        <Text
          text="Hello, LazyCanvas!"
          color="#ffffff"
          font={{ family: "sans-serif", size: 40, weight: 700 }}
          align="center"
        />
      </Group>
    </Scene>
  );
}

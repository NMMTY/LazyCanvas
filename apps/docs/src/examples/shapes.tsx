"use client";

import { Bezier, Group, Line, Morph, Polygon, Scene } from "@nmmty/adapter-react";

export default function Shapes() {
  return (
    <Scene width={520} height={220}>
      <Group>
        <Morph
          color="#0f172a"
          size={{ width: 520, height: 220 }}
          position={{ x: 0, y: 0 }}
          centring="none"
        />
        {/* With a `stroke`, a layer is outlined instead of filled */}
        <Morph
          color="#6366f1"
          size={{ width: 100, height: 100, radius: { all: 20 } }}
          stroke={{ width: 4 }}
          position={{ x: 20, y: 20 }}
          centring="none"
        />
        {/* A circle is a square with a full radius */}
        <Morph
          color="#f59e0b"
          size={{ width: 100, height: 100, radius: { all: 50 } }}
          position={{ x: 140, y: 20 }}
          centring="none"
        />
        {/* Regular polygon: `count` sides on a circle of `radius` */}
        <Polygon
          color="#22c55e"
          size={{ width: 100, height: 100, radius: 50, count: 6 }}
          position={{ x: 310, y: 70 }}
        />
        <Line
          color="#38bdf8"
          filled={false}
          stroke={{ width: 4, cap: "round" }}
          position={{ x: 20, y: 150, endX: 240, endY: 200 }}
        />
        <Bezier
          color="#f472b6"
          stroke={{ width: 4 }}
          position={{ x: 260, y: 200, endX: 500, endY: 200 }}
          controlPoints={[
            { x: 320, y: 120 },
            { x: 440, y: 280 },
          ]}
        />
      </Group>
    </Scene>
  );
}

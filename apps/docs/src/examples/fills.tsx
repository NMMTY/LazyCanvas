"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Gradient, Pattern } from "@nmmty/lazycanvas";

// Gradient points are in canvas coordinates.
const linear = new Gradient()
  .setType("linear")
  .setPoints({ x: 20, y: 20 }, { x: 140, y: 140 })
  .setStops({ color: "#f43f5e", offset: 0 }, { color: "#6366f1", offset: 1 });

const radial = new Gradient()
  .setType("radial")
  .setPoints({ x: 230, y: 80, r: 0 }, { x: 230, y: 80, r: 60 })
  .setStops({ color: "#fde047", offset: 0 }, { color: "#ea580c", offset: 1 });

const conic = new Gradient()
  .setType("conic")
  .setPoints({ x: 360, y: 80 })
  .setAngle(0)
  .setStops(
    { color: "#22d3ee", offset: 0 },
    { color: "#a78bfa", offset: 0.5 },
    { color: "#22d3ee", offset: 1 },
  );

const tile =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="10" fill="#334155"/><rect x="10" y="10" width="10" height="10" fill="#334155"/></svg>',
  );
const checker = new Pattern().setSrc(tile).setType("repeat");

export default function Fills() {
  return (
    <Scene width={520} height={160}>
      <Group>
        <Morph color={checker} size={{ width: 520, height: 160 }} position={{ x: 0, y: 0 }} centring="none" />
        <Morph color={linear} size={{ width: 120, height: 120, radius: { all: 20 } }} position={{ x: 20, y: 20 }} centring="none" />
        <Morph color={radial} size={{ width: 120, height: 120, radius: { all: 60 } }} position={{ x: 170, y: 20 }} centring="none" />
        <Morph color={conic} size={{ width: 120, height: 120, radius: { all: 60 } }} position={{ x: 300, y: 20 }} centring="none" />
      </Group>
    </Scene>
  );
}

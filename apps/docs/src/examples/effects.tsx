"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Filters } from "@nmmty/lazycanvas";

export default function Effects() {
  const box = { width: 90, height: 90, radius: { all: 16 } };

  return (
    <Scene width={520} height={160}>
      <Group>
        <Morph color="#e2e8f0" size={{ width: 520, height: 160 }} position={{ x: 0, y: 0 }} centring="none" />
        <Morph
          color="#6366f1"
          size={box}
          position={{ x: 20, y: 35 }}
          centring="none"
          shadow={{ color: "#00000066", blur: 16, offsetX: 4, offsetY: 8 }}
        />
        <Morph color="#6366f1" size={box} position={{ x: 140, y: 35 }} centring="none" opacity={0.4} />
        <Morph
          color="#6366f1"
          size={box}
          position={{ x: 260, y: 35 }}
          centring="none"
          filter={Filters.hueRotate(140)}
        />
        <Morph
          color="#6366f1"
          size={box}
          position={{ x: 380, y: 35 }}
          centring="none"
          transform={{ rotate: 20 }}
        />
      </Group>
    </Scene>
  );
}

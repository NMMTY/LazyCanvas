"use client";

import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";
import { Column, Input, Row, Slider } from "@once-ui-system/core";
import { useState } from "react";

export default function Reactive() {
  const [radius, setRadius] = useState(24);
  const [hue, setHue] = useState(260);
  const [label, setLabel] = useState("Edit me");

  return (
    <Column gap="12" horizontal="center">
      <Row gap="16" wrap fillWidth vertical="center">
        <Slider label="radius" showValue min={0} max={70} value={radius} onChange={setRadius} />
        <Slider label="hue" showValue min={0} max={360} value={hue} onChange={setHue} />
        <Input id="label" label="Text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Row>

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
    </Column>
  );
}

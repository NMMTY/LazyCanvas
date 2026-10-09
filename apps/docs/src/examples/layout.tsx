"use client";

import { Group, Morph, Scene } from "@nmmty/adapter-react";
import { Column, Row, Slider, Text, ToggleButton } from "@once-ui-system/core";
import { useState } from "react";

const JUSTIFY = ["flex-start", "center", "flex-end", "space-between", "space-around"] as const;
const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];

export default function Layout() {
  const [justifyContent, setJustify] = useState<(typeof JUSTIFY)[number]>("space-between");
  const [flexDirection, setDirection] = useState<"row" | "column">("row");
  const [gap, setGap] = useState(12);

  return (
    <Column gap="12" horizontal="center">
      <Column gap="8" fillWidth>
        <Text variant="label-default-s" onBackground="neutral-weak">
          justifyContent
        </Text>
        <Row gap="4" wrap>
          {JUSTIFY.map((value) => (
            <ToggleButton
              key={value}
              size="s"
              label={value}
              selected={justifyContent === value}
              onClick={() => setJustify(value)}
            />
          ))}
        </Row>
        <Text variant="label-default-s" onBackground="neutral-weak">
          flexDirection
        </Text>
        <Row gap="4" wrap>
          {(["row", "column"] as const).map((value) => (
            <ToggleButton
              key={value}
              size="s"
              label={value}
              selected={flexDirection === value}
              onClick={() => setDirection(value)}
            />
          ))}
        </Row>
        <Slider label="gap" showValue min={0} max={40} value={gap} onChange={setGap} />
      </Column>

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
          {COLORS.map((color) => (
            <Morph
              key={color}
              color={color}
              size={{ width: 56, height: 56, radius: { all: 12 } }}
              layout={{ width: 56, height: 56 }}
            />
          ))}
        </Group>
      </Scene>
    </Column>
  );
}

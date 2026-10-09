"use client";

import { GEIST_MONO_FAMILY } from "@/app/fonts";
import { Group, Morph, Scene, Text } from "@nmmty/adapter-react";
import { ColumnDirection, FontWeight, TextDirection, VerticalTextMode } from "@nmmty/lazycanvas";
import { useState } from "react";

const SAMPLES = {
  words: "Привет как дела",
  ideographs: "日本語の縦書き",
} as const;

/**
 * Vertical writing directions: ttb/btt, words vs ideographs, and column wrapping
 * in both directions.
 */
export default function VerticalTextTest() {
  const [direction, setDirection] = useState<TextDirection>(TextDirection.TopToBottom);
  const [mode, setMode] = useState<VerticalTextMode>(VerticalTextMode.Words);
  const [columns, setColumns] = useState<ColumnDirection>(ColumnDirection.RightToLeft);
  const [wrap, setWrap] = useState(false);

  const sample = mode === VerticalTextMode.Ideographs ? SAMPLES.ideographs : SAMPLES.words;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
      <Scene width={400} height={240} autoRender>
        <Group layout={{ width: 400, height: 240, alignItems: "center", justifyContent: "center" }}>
          <Morph
            layout={{ position: "absolute", width: 400, height: 240 }}
            size={{ width: 400, height: 240, radius: { all: 12 } }}
            color="#0f172a"
          />
          <Text
            text={wrap ? `${sample} ${sample}` : sample}
            color="#e2e8f0"
            font={{ family: GEIST_MONO_FAMILY, size: 22, weight: FontWeight.Regular }}
            align="center"
            baseline="middle"
            direction={direction}
            vertical={{ mode, columns, gap: 8 }}
            multiline={wrap ? { enabled: true, spacing: 1.2 } : undefined}
            size={wrap ? { width: 0, height: 180 } : undefined}
          />
        </Group>
      </Scene>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() =>
            setDirection((d) =>
              d === TextDirection.TopToBottom
                ? TextDirection.BottomToTop
                : TextDirection.TopToBottom,
            )
          }
        >
          {direction === TextDirection.TopToBottom ? "ttb" : "btt"}
        </button>
        <button
          type="button"
          onClick={() =>
            setMode((m) =>
              m === VerticalTextMode.Words ? VerticalTextMode.Ideographs : VerticalTextMode.Words,
            )
          }
        >
          {mode}
        </button>
        <button
          type="button"
          onClick={() =>
            setColumns((c) =>
              c === ColumnDirection.RightToLeft
                ? ColumnDirection.LeftToRight
                : ColumnDirection.RightToLeft,
            )
          }
        >
          columns {columns}
        </button>
        <button type="button" onClick={() => setWrap((v) => !v)}>
          {wrap ? "wrapping" : "single column"}
        </button>
      </div>
    </div>
  );
}

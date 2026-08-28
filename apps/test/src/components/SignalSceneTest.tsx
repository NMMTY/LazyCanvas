"use client";

import { Group, Morph, Scene, type SceneRef, Text } from "@nmmty/adapter-react";
import { Easing, Signal, all } from "@nmmty/lazycanvas";
import { useRef } from "react";

export default function SignalSceneTest() {
  const sceneRef = useRef<SceneRef>(null);
  const s = useRef(new Signal(60)).current;
  const boxColor = useRef(new Signal("#ff0000", { colorSpace: "hsl" })).current;

  function* boxAnimation() {
    yield* all(
      s.to(360, 1.5, { easing: Easing.easeInOutCubic }),
      boxColor.to("#00ff88", 1.0, { easing: Easing.easeInOutCubic }),
    );
    yield* all(
      s.to(60, 1.5, { easing: Easing.easeInOutCubic }),
      boxColor.to("#ff0000", 1.0, { easing: Easing.easeInOutCubic }),
    );
  }

  return (
    <div style={{ maxWidth: "420px" }}>
      <Scene
        ref={sceneRef}
        width={420}
        height={120}
        autoRender
        animated
        onReady={(sc) => {
          sc.addAnimation(boxAnimation);
        }}
      >
        <Group>
          <Morph color="#1e293b" size={{ width: 420, height: 120, radius: { all: 20 } }} />
          <Morph
            color={boxColor}
            size={{ width: 80, height: 80, radius: { all: 8 } }}
            position={{ x: s, y: 60 }}
          />
        </Group>
      </Scene>
    </div>
  );
}

/** @jsx createElement */
import {
  createElement,
  Scene,
  MorphLayer,
  TextLayer,
  Div,
  createSignal,
  Easing,
  resetSignals,
  all,
  chain,
  waitFor,
  calculateSequentialDuration,
  Exporter,
} from "../dist";

export async function run() {
  const width = 960;
  const height = 540;
  const scene = new Scene(width, height);

  // Create signals
  const boxX = createSignal(50);
  const boxY = createSignal(270);
  const boxWidth = createSignal(50);
  const boxHeight = createSignal(50);
  const boxOpacity = createSignal(0);
  const boxColor = createSignal("#ff0000", { colorSpace: "hsl" });

  const textX = createSignal(480);
  const textY = createSignal(50);
  const textOpacity = createSignal(0);

  // Complex animation using generators
  function* boxAnimation() {
    // Fade in and move to center
    yield* all(
      boxOpacity.to(1, 0.5, { easing: Easing.easeOut }),
      boxX.to(480, 1.0, { easing: Easing.easeInOutCubic }),
    );

    // Wait a bit
    yield* waitFor(0.2);

    // Grow and change color
    yield* all(
      boxWidth.to(150, 0.8, { easing: Easing.easeOutBack }),
      boxHeight.to(150, 0.8, { easing: Easing.easeOutBack }),
      boxColor.to("#00ff88", 1.0, { easing: Easing.linear }),
    );
  }

  function* textAnimation() {
    // Wait for box to appear
    yield* waitFor(0.5);

    // Fade in
    yield* textOpacity.to(1, 0.5, { easing: Easing.easeOut });

    // Move down a bit
    yield* textY.to(75, 0.8, { easing: Easing.easeInOutCubic });

    // Wait for box animation
    yield* waitFor(1.0);

    // Fade out
    yield* textOpacity.to(0, 0.5, { easing: Easing.easeIn });
  }

  // Load scene
  scene.load(
    <Div>
      <MorphLayer
        position={{
          x: boxX,
          y: boxY,
        }}
        size={{
          width: boxWidth,
          height: boxHeight,
        }}
        color={boxColor}
        opacity={boxOpacity}
        centring="center"
      />
      <TextLayer
        position={{
          x: textX,
          y: textY,
        }}
        text="Generator Animation"
        color={"#000000"}
        opacity={textOpacity}
        font={{
          family: "Arial",
          size: 36,
          weight: 700,
        }}
        align="center"
      />
    </Div>,
  );

  const duration = calculateSequentialDuration([() => boxAnimation(), () => textAnimation()]);

  // IMPORTANT: Reset all signals after duration calculation
  // because the calculation runs the animation and changes signal values
  resetSignals(boxX, boxY, boxWidth, boxHeight, boxOpacity, boxColor, textX, textY, textOpacity);

  // Run both animations in sequence using chain()
  scene.addAnimation(chain(boxAnimation(), textAnimation()));

  await new Exporter(scene).export("apng", {
    duration: duration,
    fps: 60,
    name: "generator-animation",
    saveAsFile: true,
  });
}

// Run if executed directly
if (require.main === module) {
  run().catch(console.error);
}

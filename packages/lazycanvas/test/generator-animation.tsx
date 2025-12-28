// test/generator-animation.tsx
/** @jsx createElement */
import { createElement } from '../src/jsx-runtime';
import { Scene, MorphLayer, TextLayer, Div } from '../src';
import { createSignal, Easing, resetSignals } from '../src/core/Signal';
import { all, chain, waitFor, loop, calculateParallelDuration } from '../src/core/SignalUtils';
import { APNGEncoder } from '../src/utils/APNGEncoder';
import * as fs from "node:fs";

/**
 * Advanced generator-based animation example
 * Demonstrates yield*, all(), chain(), loop() and complex animations
 */
export async function runGeneratorAnimation() {
    const width = 960;
    const height = 540;
    const scene = new Scene(width, height);

    // Create signals
    const boxX = createSignal(50);
    const boxY = createSignal(270);
    const boxWidth = createSignal(50);
    const boxHeight = createSignal(50);
    const boxOpacity = createSignal(0);
    const boxColor = createSignal('#ff0000', { colorSpace: 'hsl' });

    const textX = createSignal(480);
    const textY = createSignal(50);
    const textOpacity = createSignal(0);

    // Complex animation using generators
    function* boxAnimation() {
        // Fade in and move to center
        yield* all(
            boxOpacity.to(1, 0.5, { easing: Easing.easeOut }),
            boxX.to(480, 1.0, { easing: Easing.easeInOutCubic })
        );

        // Wait a bit
        yield* waitFor(0.2);

        // Grow and change color
        yield* all(
            boxWidth.to(150, 0.8, { easing: Easing.easeOutBack }),
            boxHeight.to(150, 0.8, { easing: Easing.easeOutBack }),
            boxColor.to('#00ff88', 1.0, { easing: Easing.linear })
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

    // Run both animations in parallel
    scene.addAnimation(all(
        boxAnimation(),
        textAnimation()
    ));

    // Build JSX tree
    const tree = (
        <Div>
            <MorphLayer
                x={boxX}
                y={boxY}
                size={{
                    width: boxWidth,
                    height: boxHeight
                }}
                fillStyle={boxColor}
                opacity={boxOpacity}
                centring="center"
            />
            <TextLayer
                x={textX}
                y={textY}
                text="Generator Animation"
                fillStyle="#000000"
                opacity={textOpacity}
                font={{
                    family: 'Arial',
                    size: 36,
                    weight: 700,
                }}
                align="center"
            />
        </Div>
    );

    // Load scene
    scene.load(tree);

    // Calculate animation duration automatically
    console.log('📐 Calculating animation duration...');
    const duration = calculateParallelDuration([
        () => boxAnimation(),
        () => textAnimation()
    ]);

    console.log(`✅ Animation duration: ${duration.toFixed(2)}s`);

    // IMPORTANT: Reset all signals after duration calculation
    // because the calculation runs the animation and changes signal values
    resetSignals(
        boxX, boxY, boxWidth, boxHeight, boxOpacity, boxColor,
        textX, textY, textOpacity
    );

    // Run both animations in parallel
    scene.addAnimation(all(
        boxAnimation(),
        textAnimation()
    ));

    // Render animation
    const fps = 60;
    const frames: Uint8ClampedArray[] = [];

    console.log('\n🎬 Rendering animation...');
    console.log(`Duration: ${duration}s @ ${fps} FPS = ${Math.ceil(duration * fps)} frames`);
    console.log(`Frame delta: ${(1/fps).toFixed(4)}s`);

    const startTime = Date.now();

    for (let frame = 0; frame < duration * fps; frame++) {
        const time = frame / fps;
        await scene.renderFrame(time);
        const imageData = scene.getImageData();
        frames.push(imageData);

        if (frame % 60 === 0) {
            const now = Date.now();
            const elapsed = now - startTime;
            const frameTime = frame > 0 ? (elapsed / frame) : 0;

            console.log(`  Frame ${frame}/${Math.ceil(duration * fps)} (time: ${time.toFixed(3)}s, avg: ${frameTime.toFixed(1)}ms/frame)`);

            // Log signal values for debugging
            console.log(`    boxX: ${boxX.value().toFixed(1)}, boxOpacity: ${boxOpacity.value().toFixed(3)}, color: ${boxColor.value()}`);
        }
    }

    const totalTime = Date.now() - startTime;

    console.log(`\n⏱️  Render time: ${totalTime}ms (${(totalTime / frames.length).toFixed(2)}ms per frame)`);
    console.log(`📊 Performance: ${(frames.length / (totalTime / 1000)).toFixed(2)} FPS`);

    // Encode to APNG
    console.log('\n🔧 Encoding APNG...');
    const encodeStart = Date.now();

    const encoder = new APNGEncoder(scene.width, scene.height, fps);
    for (const frame of frames) {
        encoder.addFrame(frame);
    }
    const buffer = encoder.encode();

    const encodeTime = Date.now() - encodeStart;
    console.log(`⚡ Encoding time: ${encodeTime}ms`);

    fs.writeFileSync(`./generator-animation.png`, buffer);

    console.log('✅ Generator animation rendered!');
    console.log('📁 Saved to: ./generator-animation.png');

    return frames;
}

// Run if executed directly
if (require.main === module) {
    runGeneratorAnimation().catch(console.error);
}


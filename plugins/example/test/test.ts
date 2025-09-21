import { LazyCanvas, TextLayer, MorphLayer } from "@nmmty/lazycanvas";
import { simpleExamplePlugin } from "../dist";

/**
 * Test file demonstrating the Simple Example Plugin usage
 *
 * This file shows how to:
 * 1. Register the plugin with LazyCanvas
 * 2. Perform various operations that trigger hooks
 * 3. Access plugin-specific methods
 */

async function runTest() {
    // Create a new LazyCanvas instance with proper constructor
    const canvas = new LazyCanvas();

    // Set canvas dimensions properly
    canvas.create(800, 600);

    // Register the simple example plugin
    console.log("=== Registering Plugin ===");
    canvas.use(simpleExamplePlugin);

    // Check if plugin is registered
    console.log("Plugin registered:", canvas.manager.plugins.has("simple-example"));

    // Create some layers to trigger hooks using proper LazyCanvas API
    console.log("\n=== Creating Layers ===");

    // Create text layer
    const textLayer = new TextLayer()
        .setText("Hello World!")
        .setPosition(400, 200)
        .setFont({ size: 48, family: "Arial", weight: 700 })
        .setColor("#3498db")
        .setAlign("center");

    // Create rectangle layer (using MorphLayer which can act as rectangle)
    const rectLayer = new MorphLayer()
        .setPosition(300, 300)
        .setSize(200, 100)
        .setColor("#e74c3c")
        .setID("rectangle-layer");

    // Create circle layer (using MorphLayer with border radius)
    const circleLayer = new MorphLayer()
        .setPosition(400, 450)
        .setSize(100, 100)
        .setColor("#2ecc71")
        .setSize(100, 100, { all: 50 })
        .setCentring("center")
        .setID("circle-layer");

    // Add layers to canvas (this will trigger onLayerAdded hooks)
    canvas.manager.layers.add(textLayer, rectLayer, circleLayer);

    // Trigger render (this will call beforeRender and afterRender hooks)
    console.log("\n=== Rendering Canvas ===");
    await canvas.manager.render.render("canvas");

    // Trigger another render to see statistics increase
    await canvas.manager.render.render("canvas");

    // Resize the canvas (this will trigger onResize hook)
    console.log("\n=== Resizing Canvas ===");
    canvas.resize(1.5); // Resize by ratio

    // Get plugin statistics
    console.log("\n=== Plugin Statistics ===");
    const stats = simpleExamplePlugin.getStats();
    console.log("Current statistics:", stats);

    // Export the canvas as buffer (this will trigger beforeRender and afterRender hooks)
    console.log("\n=== Exporting Canvas ===");
    try {
        const buffer = await canvas.manager.render.render("buffer");
        console.log("Export completed, buffer size:", (buffer as Buffer).length, "bytes");
        // Show final statistics
        console.log("\n=== Final Statistics ===");
        const finalStats = simpleExamplePlugin.getStats();
        console.log(finalStats);
        // Unregister the plugin
        console.log("\n=== Unregistering Plugin ===");
        canvas.manager.plugins.unregister("simple-example");
    } catch (error) {
        console.error("Export failed:", error);
    }
}
// Run the test
runTest().catch(console.error);


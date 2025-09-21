import { ILazyCanvasPlugin, LazyCanvas } from "@nmmty/lazycanvas";

/**
 * Simple Example Plugin for LazyCanvas
 *
 * This plugin demonstrates the usage of hooks in the LazyCanvas plugin system.
 * It tracks rendering statistics and provides logging for various canvas events.
 */
export class SimpleExamplePlugin implements ILazyCanvasPlugin {
    // Plugin metadata
    name = "simple-example";
    version = "1.0.0";
    description = "A simple plugin demonstrating hook usage";
    author = "LazyCanvas Team";

    // Plugin state - tracks rendering statistics
    private renderCount = 0;
    private layerCount = 0;
    private errors: Error[] = [];

    /**
     * Plugin installation method
     * Called when the plugin is registered with LazyCanvas
     */
    install(canvas: LazyCanvas): boolean {
        console.log(`[${this.name}] Plugin installed successfully!`);

        // Initialize plugin state
        this.renderCount = 0;
        this.layerCount = 0;
        this.errors = [];

        return true;
    }

    /**
     * Plugin uninstallation method (optional)
     * Called when the plugin is unregistered
     */
    uninstall(canvas: LazyCanvas): boolean {
        console.log(`[${this.name}] Plugin uninstalled. Final stats:`);
        console.log(`  - Renders: ${this.renderCount}`);
        console.log(`  - Layers created: ${this.layerCount}`);
        console.log(`  - Errors encountered: ${this.errors.length}`);

        return true;
    }

    /**
     * Hook definitions - these methods are called automatically by LazyCanvas
     * at specific points in the canvas lifecycle
     */
    hooks = {
        /**
         * Called before each render operation
         * Useful for preparing data or validating state before rendering
         */
        beforeRender: (canvas: LazyCanvas) => {
            console.log(`[${this.name}] Starting render #${this.renderCount + 1}`);
            const startTime = Date.now();

            // Store start time in canvas context for performance tracking
            (canvas as any)._pluginRenderStartTime = startTime;
        },

        /**
         * Called after each render operation
         * Perfect for cleanup, statistics, or post-processing
         */
        afterRender: (canvas: LazyCanvas) => {
            this.renderCount++;

            // Calculate render time if we stored the start time
            const startTime = (canvas as any)._pluginRenderStartTime;
            if (startTime) {
                const renderTime = Date.now() - startTime;
                console.log(`[${this.name}] Render #${this.renderCount} completed in ${renderTime}ms`);
            }
        },

        /**
         * Called when canvas dimensions are changed
         * Useful for responsive layouts or scaling calculations
         */
        onResize: (canvas: LazyCanvas, ratio: number) => {
            console.log(`[${this.name}] Canvas resized with ratio: ${ratio}`);
        },

        /**
         * Called when a new layer is added to the canvas
         * Great for tracking, validation, or automatic adjustments
         */
        onLayerAdded: (canvas: LazyCanvas, layer: any) => {
            this.layerCount++;
            console.log(`[${this.name}] Layer added: ${layer.constructor.name} (Total: ${this.layerCount})`);
        },

        /**
         * Called when a layer is removed from the canvas
         */
        onLayerRemoved: (canvas: LazyCanvas, layerId: string) => {
            console.log(`[${this.name}] Layer removed: ${layerId}`);
        },

        /**
         * Called when canvas is created or recreated
         * Useful for initial setup or dimension-dependent configurations
         */
        onCanvasCreated: (canvas: LazyCanvas, width: number, height: number) => {
            console.log(`[${this.name}] Canvas created: ${width}x${height}`);
        },

        /**
         * Called during animation frame processing
         * Perfect for frame-by-frame effects or progress tracking
         */
        onAnimationFrame: (canvas: LazyCanvas, frame: number) => {
            // Only log every 10th frame to avoid spam
            if (frame % 10 === 0) {
                console.log(`[${this.name}] Animation frame: ${frame}`);
            }
        },

        /**
         * Called when an error occurs in LazyCanvas or other plugins
         * Essential for error handling and debugging
         */
        onError: (canvas: LazyCanvas, error: Error) => {
            this.errors.push(error);
            console.error(`[${this.name}] Error detected:`, error.message);
        }
    };

    /**
     * Public method to get plugin statistics
     * This demonstrates how plugins can expose their own API
     */
    getStats() {
        return {
            renderCount: this.renderCount,
            layerCount: this.layerCount,
            errorCount: this.errors.length
        };
    }

    /**
     * Public method to reset statistics
     */
    resetStats() {
        this.renderCount = 0;
        this.layerCount = 0;
        this.errors = [];
        console.log(`[${this.name}] Statistics reset`);
    }
}

// Export the plugin instance
export const simpleExamplePlugin = new SimpleExamplePlugin();

// Default export for easy importing
export default simpleExamplePlugin;

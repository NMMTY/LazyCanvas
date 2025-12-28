// src/core/Scene.ts
import { Canvas, SKRSContext2D } from '@napi-rs/canvas';
import { LayersManager } from '../structures/managers';
import { BaseLayer, Div } from '../structures/components';
import { AnyLayer } from "../types";
import { ThreadScheduler } from './ThreadScheduler';
import { ThreadGenerator, Signal } from './Signal';

/**
 * Scene class - manages canvas, context, layers, and animation timeline
 */
export class Scene {
    public readonly canvas: Canvas;
    public readonly ctx: SKRSContext2D;
    public readonly manager: LayersManager;
    public root: Div | AnyLayer | null = null;

    private allLayers: (AnyLayer | Div)[] = [];
    private scheduler: ThreadScheduler = new ThreadScheduler();
    private lastFrameTime = 0;

    /**
     * Create a new Scene
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     */
    constructor(width: number, height: number) {
        this.canvas = new Canvas(width, height);
        this.ctx = this.canvas.getContext('2d');

        // Create a minimal LazyCanvas-like object for LayersManager
        // LayersManager expects a LazyCanvas instance, but we create a standalone scene
        const fakeLazyCanvas = {
            canvas: this.canvas,
            ctx: this.ctx,
            manager: null as any
        };

        this.manager = new LayersManager({ debug: false });
        fakeLazyCanvas.manager = { layers: this.manager };
    }

    /**
     * Load a layer tree created via JSX
     * Registers all layers with IDs into the manager
     * @param tree - Root layer or group
     */
    public load(tree: AnyLayer | Div): void {
        this.root = tree;
        this.allLayers = [];

        // Register all layers recursively
        this.registerRecursively(tree);
    }

    /**
     * Recursively register layers in the manager and collect them
     * @param layer - Layer or group to register
     */
    private registerRecursively(layer: AnyLayer | Div): void {
        // Add to our internal list for updateState iteration
        this.allLayers.push(layer);

        // Register in manager if it has an ID
        if (layer.id && !this.manager.map.has(layer.id)) {
            this.manager.add(layer);
        }

        // If it's a group, recurse into children
        if (layer instanceof Div && layer.layers) {
            for (const child of layer.layers) {
                this.registerRecursively(child);
            }
        }
    }

    /**
     * Render a single frame at the given time
     * @param time - Time in seconds
     */
    public async renderFrame(time: number): Promise<void> {
        if (!this.root) {
            throw new Error('Scene: No root layer loaded. Call scene.load(tree) first.');
        }

        // 1. Update scheduler with current time
        this.scheduler.update(time);

        // 2. Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 3. PHASE 1: Update all layer states from signals
        this.updateAllStates(time);

        // 4. PHASE 2: Draw the layer tree
        await this.drawLayer(this.root);

        this.lastFrameTime = time;
    }

    /**
     * Get current frame as ImageData (Uint8ClampedArray)
     * Much faster than encoding to PNG
     */
    public getImageData(): Uint8ClampedArray {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        return imageData.data;
    }

    /**
     * Get canvas width
     */
    public get width(): number {
        return this.canvas.width;
    }

    /**
     * Get canvas height
     */
    public get height(): number {
        return this.canvas.height;
    }

    /**
     * Update state for all layers that have signals
     * @param time - Current time in seconds
     */
    private updateAllStates(time: number): void {
        for (const layer of this.allLayers) {
            // Check if layer has updateState method (added by BaseLayer)
            if ('updateState' in layer && typeof layer.updateState === 'function') {
                layer.updateState(time);
            }
        }
    }

    /**
     * Draw a layer or group
     * @param layer - Layer to draw
     */
    private async drawLayer(layer: AnyLayer | Div): Promise<void> {
        if (!layer.visible) return;

        // Set global composite operation if present
        if ('props' in layer && layer.props?.globalComposite) {
            this.ctx.globalCompositeOperation = layer.props.globalComposite;
        }

        // Draw the layer
        if ('draw' in layer && typeof layer.draw === 'function') {
            await layer.draw(this.ctx, this.canvas, this.manager, false);
        }

        // Reset shadow after drawing
        this.ctx.shadowColor = 'transparent';
    }

    /**
     * Render multiple frames and return as animation
     * @param startTime - Start time in seconds
     * @param endTime - End time in seconds
     * @param fps - Frames per second (default: 30)
     * @returns Array of PNG buffers for each frame
     */
    public async renderAnimation(startTime: number, endTime: number, fps: number = 30): Promise<Buffer[]> {
        const frames: Buffer[] = [];
        const frameDuration = 1 / fps;

        for (let time = startTime; time <= endTime; time += frameDuration) {
            await this.renderFrame(time);
            frames.push(await this.canvas.encode('png'));
        }

        return frames;
    }

    /**
     * Render multiple frames and return as ImageData array (much faster)
     * @param startTime - Start time in seconds
     * @param endTime - End time in seconds
     * @param fps - Frames per second (default: 30)
     * @returns Array of Uint8ClampedArray for each frame
     */
    public async renderAnimationData(startTime: number, endTime: number, fps: number = 30): Promise<Uint8ClampedArray[]> {
        const frames: Uint8ClampedArray[] = [];
        const frameDuration = 1 / fps;

        for (let time = startTime; time <= endTime; time += frameDuration) {
            await this.renderFrame(time);
            frames.push(this.getImageData());
        }

        return frames;
    }

    /**
     * Get a layer by ID from the manager
     * @param id - Layer ID
     * @returns Layer or undefined
     */
    public getLayer(id: string): AnyLayer | Div | undefined {
        return this.manager.get(id, true);
    }

    /**
     * Add animation generator to scheduler
     * @param generator - Animation generator to run
     */
    public addAnimation(generator: ThreadGenerator): void {
        this.scheduler.add(generator);
    }

    /**
     * Play animation on a signal
     * @param signal - Signal to animate
     * @param generator - Animation generator
     */
    public playAnimation<T>(signal: Signal<T>, generator: ThreadGenerator): void {
        signal.run(generator);
        this.scheduler.add(generator);
    }

    /**
     * Clear all animations
     */
    public clearAnimations(): void {
        this.scheduler.clear();
    }

    /**
     * Reset scene timeline
     */
    public resetTimeline(): void {
        this.scheduler.reset();
        this.lastFrameTime = 0;
    }
}
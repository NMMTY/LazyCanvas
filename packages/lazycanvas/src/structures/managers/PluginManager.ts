import { LazyCanvas } from "../LazyCanvas";
import { LazyLog, LazyError } from "../../utils/LazyUtil";
import { AnyLayer } from "../../types";
import { Group } from "../components";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";

/**
 * Interface representing a LazyCanvas plugin.
 */
export interface ILazyCanvasPlugin {
    /**
     * The unique name of the plugin.
     */
    name: string;

    /**
     * The version of the plugin.
     */
    version: string;

    /**
     * Optional description of the plugin.
     */
    description?: string;

    /**
     * Optional author of the plugin.
     */
    author?: string;

    /**
     * Optional dependencies on other plugins.
     */
    dependencies?: string[];

    /**
     * Optional configuration object for the plugin.
     */
    config?: any;

    /**
     * Optional private data storage for the plugin.
     */
    private?: any;

    /**
     * Method called when the plugin is installed.
     * @param canvas - The LazyCanvas instance.
     * @returns true if installation was successful, false otherwise.
     */
    install(canvas: LazyCanvas): boolean;

    /**
     * Optional method called when the plugin is uninstalled.
     * @param canvas - The LazyCanvas instance.
     * @returns true if uninstallation was successful, false otherwise.
     */
    uninstall?(canvas: LazyCanvas): boolean;

    /**
     * Optional hooks for lifecycle events.
     */
    hooks?: IPluginHooks;
}

/**
 * Interface representing plugin hooks for lifecycle events.
 */
export interface IPluginHooks {
    /**
     * Called before rendering starts.
     */
    beforeRender?(canvas: LazyCanvas): void;

    /**
     * Called after rendering completes.
     */
    afterRender?(canvas: LazyCanvas): void;

    /**
     * Called before export starts.
     */
    beforeExport?(canvas: LazyCanvas): void;

    /**
     * Called after export completes.
     */
    afterExport?(canvas: LazyCanvas, result: string | Buffer<ArrayBufferLike> | SKRSContext2D | Canvas | SvgCanvas): void;

    /**
     * Called when canvas is resized.
     */
    onResize?(canvas: LazyCanvas, ratio: number): void;

    /**
     * Called when a layer is added.
     */
    onLayerAdded?(canvas: LazyCanvas, layer: AnyLayer | Group): void;

    /**
     * Called when a layer is removed.
     */
    onLayerRemoved?(canvas: LazyCanvas, layerId: string): void;

    /**
     * Called when canvas is created/recreated.
     */
    onCanvasCreated?(canvas: LazyCanvas, width: number, height: number): void;

    /**
     * Called when a layer is modified.
     */
    onLayerModified?(canvas: LazyCanvas, layer: AnyLayer | Group): void;

    /**
     * Called when animation frame is processed.
     */
    onAnimationFrame?(canvas: LazyCanvas, frame: number): void;

    /**
     * Called when an error occurs.
     */
    onError?(canvas: LazyCanvas, error: Error): void;
}

/**
 * Interface representing the PluginManager.
 */
export interface IPluginManager {
    /**
     * A map storing installed plugins with their names as keys.
     */
    plugins: Map<string, ILazyCanvasPlugin>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Reference to the LazyCanvas instance.
     */
    canvas: LazyCanvas;

    /**
     * Registers a plugin.
     * @param plugin - The plugin to register.
     */
    register(plugin: ILazyCanvasPlugin): void;

    /**
     * Unregisters a plugin by name.
     * @param pluginName - The name of the plugin to unregister.
     * @throws {LazyError} If the plugin is not found or if other plugins depend on it.
     */
    unregister(pluginName: string): void;

    /**
     * Gets a plugin by name.
     * @param pluginName - The name of the plugin.
     */
    get(pluginName: string): ILazyCanvasPlugin | undefined;

    /**
     * Lists all registered plugin names.
     */
    list(): string[];

    /**
     * Checks if a plugin is registered.
     * @param pluginName - The name of the plugin.
     */
    has(pluginName: string): boolean;

    /**
     * Executes a hook for all plugins that implement it.
     * @param hookName - The name of the hook to execute.
     * @param args - Arguments to pass to the hook.
     */
    executeHook(hookName: keyof IPluginHooks, ...args: any[]): void;
}

/**
 * Class representing a manager for handling plugins.
 */
export class PluginManager implements IPluginManager {
    /**
     * A map storing installed plugins with their names as keys.
     */
    plugins: Map<string, ILazyCanvasPlugin>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Reference to the LazyCanvas instance.
     */
    canvas: LazyCanvas;

    /**
     * Constructs a new PluginManager instance.
     * @param {LazyCanvas} [canvas] - The LazyCanvas instance.
     * @param {Object} [opts] - Optional settings for the PluginManager.
     * @param {boolean} [opts.debug] - Whether debugging is enabled.
     */
    constructor(canvas: LazyCanvas, opts?: { debug?: boolean }) {
        this.plugins = new Map();
        this.debug = opts?.debug || false;
        this.canvas = canvas;
    }

    /**
     * Registers a plugin.
     * @param {ILazyCanvasPlugin} [plugin] - The plugin to register.
     * @throws {LazyError} If a plugin with the same name is already registered.
     */
    public register(plugin: ILazyCanvasPlugin): void {
        if (this.plugins.has(plugin.name)) {
            throw new LazyError(`Plugin '${plugin.name}' is already registered`);
        }

        // Check dependencies
        if (plugin.dependencies) {
            for (const dependency of plugin.dependencies) {
                if (!this.plugins.has(dependency)) {
                    throw new LazyError(`Plugin '${plugin.name}' requires dependency '${dependency}' which is not installed`);
                }
            }
        }

        try {
            const result = plugin.install(this.canvas);
            this.plugins.set(plugin.name, plugin);

            if (this.debug) {
                LazyLog.log('info', `Plugin '${plugin.name}' v${plugin.version} registered successfully`);
            }
        } catch (error) {
            throw new LazyError(`Failed to install plugin '${plugin.name}': ${error}`);
        }
    }

    /**
     * Unregisters a plugin by name.
     * @param {string} [pluginName] - The name of the plugin to unregister.
     * @throws {LazyError} If the plugin is not found or if other plugins depend on it.
     */
    public unregister(pluginName: string): void {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new LazyError(`Plugin '${pluginName}' is not registered`);
        }

        // Check if other plugins depend on this one
        this.plugins.forEach((p, name) => {
            if (name !== pluginName && p.dependencies?.includes(pluginName)) {
                throw new LazyError(`Cannot unregister plugin '${pluginName}' because plugin '${name}' depends on it`);
            }
        });

        try {
            if (plugin.uninstall) {
                plugin.uninstall(this.canvas);
            }
            this.plugins.delete(pluginName);

            if (this.debug) {
                LazyLog.log('info', `Plugin '${pluginName}' unregistered successfully`);
            }
        } catch (error) {
            throw new LazyError(`Failed to uninstall plugin '${pluginName}': ${error}`);
        }
    }

    /**
     * Gets a plugin by name.
     * @param {string} [pluginName] - The name of the plugin.
     * @returns The plugin or undefined if not found.
     */
    public get(pluginName: string): ILazyCanvasPlugin | undefined {
        return this.plugins.get(pluginName);
    }

    /**
     * Lists all registered plugin names.
     * @returns Array of plugin names.
     */
    public list(): string[] {
        return Array.from(this.plugins.keys());
    }

    /**
     * Checks if a plugin is registered.
     * @param {string} [pluginName] - The name of the plugin.
     * @returns True if the plugin is registered, false otherwise.
     */
    public has(pluginName: string): boolean {
        return this.plugins.has(pluginName);
    }

    /**
     * Executes a hook for all plugins that implement it.
     * @param {keyof IPluginHooks} [hookName] - The name of the hook to execute.
     * @param {any} [args] - Arguments to pass to the hook.
     */
    public executeHook(hookName: keyof IPluginHooks, ...args: any[]): void {
        this.plugins.forEach(plugin => {
            try {
                const hook = plugin.hooks?.[hookName];
                if (hook) {
                    (hook as any)(...args);
                }
            } catch (error) {
                if (this.debug) {
                    LazyLog.log('error', `Error executing hook '${hookName}' for plugin '${plugin.name}': ${error}`);
                }
                // Execute onError hook for all plugins when a hook fails
                this.executeErrorHook(error as Error);
            }
        });
    }

    /**
     * Executes the onError hook for all plugins when an error occurs.
     * @param error - The error that occurred.
     */
    private executeErrorHook(error: Error): void {
        this.plugins.forEach(plugin => {
            try {
                const errorHook = plugin.hooks?.onError;
                if (errorHook) {
                    errorHook(this.canvas, error);
                }
            } catch (hookError) {
                if (this.debug) {
                    LazyLog.log('error', `Error in onError hook for plugin '${plugin.name}': ${hookError}`);
                }
            }
        });
    }

    /**
     * Gets plugin information.
     * @returns Array of plugin information objects.
     */
    public getPluginInfo(): Array<{ name: string; version: string; description?: string; dependencies?: string[] }> {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            dependencies: plugin.dependencies
        }));
    }

    /**
     * Clears all plugins.
     */
    public clear(): void {
        const pluginNames = this.list();
        for (const name of pluginNames) {
            try {
                this.unregister(name);
            } catch (error) {
                if (this.debug) {
                    LazyLog.log('error', `Error unregistering plugin '${name}': ${error}`);
                }
            }
        }
    }
}

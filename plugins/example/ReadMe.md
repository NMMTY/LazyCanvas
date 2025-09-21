# LazyCanvas Plugin System Documentation

## Overview

The LazyCanvas plugin system provides a powerful and flexible way to extend the functionality of LazyCanvas through hooks and custom plugins. Plugins can listen to various lifecycle events, modify canvas behavior, and add new features without modifying the core LazyCanvas code.

## Plugin Architecture

### Core Components

1. **PluginManager**: Manages plugin registration, unregistration, and hook execution
2. **ILazyCanvasPlugin Interface**: Defines the contract that all plugins must implement
3. **IPluginHooks Interface**: Defines available lifecycle hooks
4. **Hook System**: Automatically executes plugin hooks at specific lifecycle events

### Plugin Structure

Every plugin must implement the `ILazyCanvasPlugin` interface:

```typescript
interface ILazyCanvasPlugin {
    name: string;           // Unique plugin identifier
    version: string;        // Plugin version
    description?: string;   // Optional description
    author?: string;        // Optional author information
    dependencies?: string[]; // Optional plugin dependencies
    config?: any;           // Optional configuration object
    private?: any;          // Optional private data storage
    
    // Required methods
    install(canvas: LazyCanvas): boolean;
    uninstall?(canvas: LazyCanvas): boolean;
    
    // Optional hooks
    hooks?: IPluginHooks;
}
```

## Available Hooks

The plugin system provides the following lifecycle hooks that are actually implemented in LazyCanvas:

### Rendering Hooks

| Hook | Description | Parameters | When Called |
|------|-------------|------------|-------------|
| `beforeRender` | Called before rendering starts | `canvas: LazyCanvas` | Before each render operation |
| `afterRender` | Called after rendering completes | `canvas: LazyCanvas` | After each render operation |

### Canvas Lifecycle Hooks

| Hook | Description | Parameters | When Called |
|------|-------------|------------|-------------|
| `onCanvasCreated` | Called when canvas is created/recreated | `canvas: LazyCanvas, width: number, height: number` | When canvas.create() is called |
| `onResize` | Called when canvas is resized | `canvas: LazyCanvas, ratio: number` | When canvas.resize() is called |

### Layer Management Hooks

| Hook | Description | Parameters | When Called |
|------|-------------|------------|-------------|
| `onLayerAdded` | Called when a layer is added | `canvas: LazyCanvas, layer: AnyLayer \| Group` | When layers are added via LayersManager.add() |
| `onLayerRemoved` | Called when a layer is removed | `canvas: LazyCanvas, layerId: string` | When layers are removed via LayersManager.remove() |

### Animation Hooks

| Hook | Description | Parameters | When Called |
|------|-------------|------------|-------------|
| `onAnimationFrame` | Called during animation frame processing | `canvas: LazyCanvas, frame: number` | For each animation frame during animated renders |

### Error Handling Hooks

| Hook | Description | Parameters | When Called |
|------|-------------|------------|-------------|
| `onError` | Called when an error occurs | `canvas: LazyCanvas, error: Error` | When errors occur in LazyCanvas or plugins |

**Note**: Some hooks defined in the interface (like `beforeExport`, `afterExport`, `onLayerModified`) are not currently implemented in the LazyCanvas core but may be added in future versions.

## Plugin Manager API

### Registration

```typescript
// Register a plugin
canvas.manager.plugins.register(plugin);

// Check if plugin is registered
canvas.manager.plugins.has('plugin-name');

// Get plugin instance
const plugin = canvas.manager.plugins.get('plugin-name');
```

### Management

```typescript
// List all registered plugins
const pluginNames = canvas.manager.plugins.list();

// Get plugin information
const pluginInfo = canvas.manager.plugins.getPluginInfo();

// Unregister a plugin
canvas.manager.plugins.unregister('plugin-name');

// Clear all plugins
canvas.manager.plugins.clear();
```

### Hook Execution

Hooks are executed automatically by the PluginManager, but you can also trigger them manually:

```typescript
// Execute a specific hook for all plugins
canvas.manager.plugins.executeHook('beforeRender', canvas);
```

## Creating a Plugin

### Basic Plugin Template

```typescript
import { ILazyCanvasPlugin, LazyCanvas } from "@nmmty/lazycanvas";

export class MyPlugin implements ILazyCanvasPlugin {
    name = "my-plugin";
    version = "1.0.0";
    description = "My custom plugin";
    author = "Your Name";

    // Plugin installation
    install(canvas: LazyCanvas): boolean {
        console.log(`${this.name} installed`);
        return true;
    }

    // Optional cleanup
    uninstall(canvas: LazyCanvas): boolean {
        console.log(`${this.name} uninstalled`);
        return true;
    }

    // Hook implementations (only use hooks that are actually implemented)
    hooks = {
        beforeRender: (canvas: LazyCanvas) => {
            // Your pre-render logic
        },

        afterRender: (canvas: LazyCanvas) => {
            // Your post-render logic
        },

        onLayerAdded: (canvas: LazyCanvas, layer: any) => {
            // Handle new layers
        }
    };
}

// Export plugin instance
export const myPlugin = new MyPlugin();
```

## LazyCanvas API Usage

### Creating and Setting Up Canvas

```typescript
// Create canvas with debug enabled
const canvas = new LazyCanvas({ debug: true });

// Set canvas dimensions
canvas.create(800, 600);
```

### Working with Layers

```typescript
import { TextLayer, MorphLayer } from "@nmmty/lazycanvas";

// Create text layer
const textLayer = new TextLayer()
    .setText("Hello World!")
    .setPosition(400, 200)
    .setFont({ size: 48, family: "Arial", weight: "bold" })
    .setColor("#3498db")
    .setAlign("center");

// Create rectangle using MorphLayer
const rectLayer = new MorphLayer()
    .setPosition(300, 300)
    .setSize(200, 100)
    .setColor("#e74c3c");

// Create circle using MorphLayer with border radius
const circleLayer = new MorphLayer()
    .setPosition(400, 450)
    .setSize(100, 100)
    .setColor("#2ecc71")
    .setBorderRadius({ all: 50 }) // Makes it circular
    .setCentring("center");

// Add layers to canvas
canvas.manager.layers.add(textLayer, rectLayer, circleLayer);
```

### Rendering and Exporting

```typescript
// Render to canvas
await canvas.manager.render.render("canvas");

// Export as buffer
const buffer = await canvas.manager.render.render("buffer");

// Export as SVG
const svg = await canvas.manager.render.render("svg");

// Get rendering context
const ctx = await canvas.manager.render.render("ctx");
```

### Plugin Dependencies

Plugins can depend on other plugins:

```typescript
export class DependentPlugin implements ILazyCanvasPlugin {
    name = "dependent-plugin";
    version = "1.0.0";
    dependencies = ["base-plugin", "utility-plugin"];

    install(canvas: LazyCanvas): boolean {
        // This plugin will only install if dependencies are already registered
        return true;
    }
}
```

## Best Practices

### 1. Error Handling

Always implement proper error handling in your hooks:

```typescript
hooks = {
    beforeRender: (canvas: LazyCanvas) => {
        try {
            // Your logic here
        } catch (error) {
            console.error(`Error in ${this.name}:`, error);
        }
    }
};
```

### 2. Performance Considerations

- Avoid heavy computations in frequently called hooks like `beforeRender` and `afterRender`
- Use `onAnimationFrame` sparingly, as it's called for every frame
- Cache expensive operations when possible

### 3. State Management

Use the plugin's private properties to maintain state:

```typescript
export class StatefulPlugin implements ILazyCanvasPlugin {
    name = "stateful-plugin";
    version = "1.0.0";
    
    private renderCount = 0;
    private lastRenderTime = 0;

    hooks = {
        beforeRender: (canvas: LazyCanvas) => {
            this.lastRenderTime = Date.now();
        },

        afterRender: (canvas: LazyCanvas) => {
            this.renderCount++;
            const renderTime = Date.now() - this.lastRenderTime;
            console.log(`Render #${this.renderCount} took ${renderTime}ms`);
        }
    };
}
```

## Usage Examples

### Statistics Tracking Plugin

```typescript
export class StatsPlugin implements ILazyCanvasPlugin {
    name = "stats-tracker";
    version = "1.0.0";

    private stats = {
        renders: 0,
        layers: 0,
        errors: 0
    };

    hooks = {
        afterRender: () => this.stats.renders++,
        onLayerAdded: () => this.stats.layers++,
        onError: () => this.stats.errors++
    };

    getStats() {
        return { ...this.stats };
    }
}
```

### Performance Monitor Plugin

```typescript
export class PerformancePlugin implements ILazyCanvasPlugin {
    name = "performance-monitor";
    version = "1.0.0";

    private renderTimes: number[] = [];

    hooks = {
        beforeRender: (canvas: LazyCanvas) => {
            (canvas as any)._perfStartTime = performance.now();
        },

        afterRender: (canvas: LazyCanvas) => {
            const startTime = (canvas as any)._perfStartTime;
            if (startTime) {
                const renderTime = performance.now() - startTime;
                this.renderTimes.push(renderTime);
                
                // Keep only last 100 measurements
                if (this.renderTimes.length > 100) {
                    this.renderTimes.shift();
                }
            }
        }
    };

    getAverageRenderTime(): number {
        return this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    }
}
```

## Troubleshooting

### Common Issues

1. **Plugin Not Found**: Ensure the plugin is registered before use
2. **Dependency Errors**: Install dependencies before dependent plugins
3. **Hook Errors**: Check that hook implementations don't throw uncaught exceptions
4. **Memory Leaks**: Properly clean up resources in the `uninstall` method

### Debugging

Enable debug mode when creating LazyCanvas to see plugin-related logs:

```typescript
const canvas = new LazyCanvas({
    debug: true
});
```

This will log plugin registration, unregistration, and hook execution errors to the console.

## Conclusion

The LazyCanvas plugin system provides a powerful way to extend functionality through a clean, event-driven architecture. By implementing the `ILazyCanvasPlugin` interface and utilizing the available hooks, you can create sophisticated plugins that integrate seamlessly with LazyCanvas operations.

# LazyCanvas Hook System Guide

## What are Hooks?

Hooks in the LazyCanvas plugin system are predefined callback points that allow plugins to execute custom code at specific moments in the canvas lifecycle. They provide a clean, event-driven architecture for extending LazyCanvas functionality without modifying core code.

## Hook Execution Flow

The LazyCanvas core automatically triggers hooks at appropriate times:

```
Canvas Operation → PluginManager.executeHook() → All Plugin Hooks → Continue Operation
```

### Example Flow for Rendering:
1. User calls `canvas.render()`
2. RenderManager calls `beforeRender` hook
3. All plugins with `beforeRender` hook execute their code
4. Actual rendering happens
5. RenderManager calls `afterRender` hook
6. All plugins with `afterRender` hook execute their code
7. Render operation completes

## Detailed Hook Reference

### 1. Rendering Hooks

#### beforeRender
- **Purpose**: Prepare data, validate state, or set up resources before rendering
- **Parameters**: `canvas: LazyCanvas`
- **Use Cases**: 
  - Performance timing
  - State validation
  - Resource preparation
  - Pre-render transformations

```typescript
beforeRender: (canvas: LazyCanvas) => {
    // Start performance timer
    console.time('render-time');
    
    // Validate canvas state
    if (!canvas.manager.layers.getLayers().length) {
        console.warn('Rendering empty canvas');
    }
    
    // Prepare resources
    canvas.manager.fonts.preloadFonts();
}
```

#### afterRender
- **Purpose**: Clean up, collect statistics, or perform post-processing
- **Parameters**: `canvas: LazyCanvas`
- **Use Cases**:
  - Performance measurement
  - Statistics collection
  - Resource cleanup
  - Notifications

```typescript
afterRender: (canvas: LazyCanvas) => {
    // End performance timer
    console.timeEnd('render-time');
    
    // Update statistics
    this.renderCount++;
    
    // Trigger notifications
    this.notifyRenderComplete();
}
```

### 2. Export Hooks

#### beforeExport
- **Purpose**: Optimize canvas or prepare for specific export formats
- **Parameters**: `canvas: LazyCanvas`
- **Use Cases**:
  - Format-specific optimizations
  - Quality adjustments
  - Metadata preparation

```typescript
beforeExport: (canvas: LazyCanvas) => {
    // Optimize for export
    canvas.manager.render.setHighQuality(true);
    
    // Prepare metadata
    this.addExportMetadata(canvas);
    
    console.log('Canvas prepared for export');
}
```

#### afterExport
- **Purpose**: Process exported data or perform cleanup
- **Parameters**: `canvas: LazyCanvas, result: any`
- **Use Cases**:
  - File size analysis
  - Post-processing
  - Cleanup
  - Success notifications

```typescript
afterExport: (canvas: LazyCanvas, result: any) => {
    // Analyze export result
    if (result && result.byteLength) {
        console.log(`Export size: ${(result.byteLength / 1024).toFixed(2)} KB`);
    }
    
    // Reset quality settings
    canvas.manager.render.setHighQuality(false);
    
    // Send analytics
    this.trackExport(result);
}
```

### 3. Canvas Lifecycle Hooks

#### onCanvasCreated
- **Purpose**: Initialize plugin state when canvas is created
- **Parameters**: `canvas: LazyCanvas, width: number, height: number`
- **Use Cases**:
  - Dimension-dependent setup
  - Grid initialization
  - Background preparation

```typescript
onCanvasCreated: (canvas: LazyCanvas, width: number, height: number) => {
    // Initialize grid based on canvas size
    this.initializeGrid(width, height);
    
    // Set up guides
    this.createGuides(width / 2, height / 2);
    
    console.log(`Canvas initialized: ${width}x${height}`);
}
```

#### onResize
- **Purpose**: Adapt to canvas dimension changes
- **Parameters**: `canvas: LazyCanvas, ratio: number`
- **Use Cases**:
  - Responsive adjustments
  - Grid recalculation
  - UI element repositioning

```typescript
onResize: (canvas: LazyCanvas, ratio: number) => {
    // Adjust grid to new dimensions
    this.rescaleGrid(ratio);
    
    // Update responsive elements
    this.updateResponsiveElements(ratio);
    
    console.log(`Canvas resized by factor: ${ratio}`);
}
```

### 4. Layer Management Hooks

#### onLayerAdded
- **Purpose**: React to new layers being added
- **Parameters**: `canvas: LazyCanvas, layer: AnyLayer | Group`
- **Use Cases**:
  - Layer validation
  - Automatic adjustments
  - Statistics tracking
  - Notifications

```typescript
onLayerAdded: (canvas: LazyCanvas, layer: any) => {
    // Validate layer properties
    this.validateLayer(layer);
    
    // Auto-adjust positioning
    if (this.config.autoAlign) {
        this.alignLayer(layer);
    }
    
    // Track statistics
    this.layerStats.total++;
    this.layerStats.byType[layer.constructor.name]++;
    
    console.log(`Added ${layer.constructor.name} layer`);
}
```

#### onLayerRemoved
- **Purpose**: Clean up when layers are removed
- **Parameters**: `canvas: LazyCanvas, layerId: string`
- **Use Cases**:
  - Reference cleanup
  - Memory management
  - Statistics updates

```typescript
onLayerRemoved: (canvas: LazyCanvas, layerId: string) => {
    // Clean up references
    this.cleanupLayerReferences(layerId);
    
    // Update statistics
    this.layerStats.total--;
    
    console.log(`Removed layer: ${layerId}`);
}
```

#### onLayerModified
- **Purpose**: React to layer property changes
- **Parameters**: `canvas: LazyCanvas, layer: AnyLayer | Group`
- **Use Cases**:
  - Change tracking
  - Automatic updates
  - Validation
  - Notifications

```typescript
onLayerModified: (canvas: LazyCanvas, layer: any) => {
    // Track changes
    this.changeHistory.push({
        layerId: layer.id,
        timestamp: Date.now(),
        type: 'modified'
    });
    
    // Validate modifications
    this.validateLayerProperties(layer);
    
    // Trigger dependent updates
    this.updateDependentLayers(layer);
}
```

### 5. Animation Hooks

#### onAnimationFrame
- **Purpose**: Execute per-frame logic during animations
- **Parameters**: `canvas: LazyCanvas, frame: number`
- **Use Cases**:
  - Frame-by-frame effects
  - Progress tracking
  - Dynamic updates
  - Performance monitoring

```typescript
onAnimationFrame: (canvas: LazyCanvas, frame: number) => {
    // Update frame-based effects
    this.updateParticleSystem(frame);
    
    // Track animation progress
    if (frame % 30 === 0) { // Every second at 30fps
        console.log(`Animation frame: ${frame}`);
    }
    
    // Monitor performance
    if (frame > 1000) { // After 1000 frames
        this.analyzeAnimationPerformance();
    }
}
```

### 6. Error Handling Hooks

#### onError
- **Purpose**: Handle errors from LazyCanvas or other plugins
- **Parameters**: `canvas: LazyCanvas, error: Error`
- **Use Cases**:
  - Error logging
  - Recovery attempts
  - User notifications
  - Debugging

```typescript
onError: (canvas: LazyCanvas, error: Error) => {
    // Log detailed error information
    console.error(`[${this.name}] Error detected:`, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    // Attempt recovery
    if (this.canRecover(error)) {
        this.attemptRecovery(canvas, error);
    }
    
    // Notify user
    this.notifyError(error);
    
    // Update error statistics
    this.errorStats.count++;
    this.errorStats.types[error.constructor.name]++;
}
```

## Hook Best Practices

### 1. Performance Optimization

```typescript
// Good: Cache expensive calculations
hooks = {
    onLayerAdded: (canvas: LazyCanvas, layer: any) => {
        if (!this.layerCache) {
            this.layerCache = new Map();
        }
        this.layerCache.set(layer.id, this.processLayer(layer));
    }
};

// Bad: Recalculate every time
hooks = {
    onLayerAdded: (canvas: LazyCanvas, layer: any) => {
        this.expensiveCalculation(layer); // Runs every time
    }
};
```

### 2. Error Handling

```typescript
// Good: Proper error handling
hooks = {
    beforeRender: (canvas: LazyCanvas) => {
        try {
            this.prepareRender(canvas);
        } catch (error) {
            console.error(`Error in ${this.name} beforeRender:`, error);
            // Don't break the render chain
        }
    }
};

// Bad: Unhandled errors
hooks = {
    beforeRender: (canvas: LazyCanvas) => {
        this.prepareRender(canvas); // Could throw and break rendering
    }
};
```

### 3. Conditional Logic

```typescript
// Good: Use configuration for conditional behavior
hooks = {
    afterRender: (canvas: LazyCanvas) => {
        if (this.config.enableStats) {
            this.updateStats();
        }
        
        if (this.config.autoSave) {
            this.autoSave(canvas);
        }
    }
};
```

### 4. Resource Management

```typescript
// Good: Clean up resources
install(canvas: LazyCanvas): boolean {
    this.timers = [];
    this.eventListeners = [];
    return true;
}

uninstall(canvas: LazyCanvas): boolean {
    // Clean up timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
    
    // Remove event listeners
    this.eventListeners.forEach(listener => 
        listener.element.removeEventListener(listener.event, listener.handler)
    );
    this.eventListeners = [];
    
    return true;
}
```

## Advanced Hook Patterns

### 1. Hook Chaining

```typescript
class ChainedPlugin implements ILazyCanvasPlugin {
    name = "chained-plugin";
    version = "1.0.0";
    
    private pipeline: Array<(canvas: LazyCanvas) => void> = [];
    
    addToRenderPipeline(fn: (canvas: LazyCanvas) => void) {
        this.pipeline.push(fn);
    }
    
    hooks = {
        beforeRender: (canvas: LazyCanvas) => {
            // Execute all functions in pipeline
            this.pipeline.forEach(fn => {
                try {
                    fn(canvas);
                } catch (error) {
                    console.error('Pipeline function failed:', error);
                }
            });
        }
    };
}
```

### 2. State Machine Integration

```typescript
class StateMachinePlugin implements ILazyCanvasPlugin {
    name = "state-machine-plugin";
    version = "1.0.0";
    
    private state = 'idle';
    private transitions = {
        idle: ['rendering'],
        rendering: ['idle', 'exporting'],
        exporting: ['idle']
    };
    
    private transitionTo(newState: string) {
        if (this.transitions[this.state]?.includes(newState)) {
            console.log(`State transition: ${this.state} → ${newState}`);
            this.state = newState;
        }
    }
    
    hooks = {
        beforeRender: () => this.transitionTo('rendering'),
        afterRender: () => this.transitionTo('idle'),
        beforeExport: () => this.transitionTo('exporting'),
        afterExport: () => this.transitionTo('idle')
    };
}
```

## Conclusion

The LazyCanvas hook system provides powerful extension points that allow plugins to integrate deeply with canvas operations. By understanding when each hook is called and following best practices, you can create sophisticated plugins that enhance LazyCanvas functionality while maintaining performance and reliability.

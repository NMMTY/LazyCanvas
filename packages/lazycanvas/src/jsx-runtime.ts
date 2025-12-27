// src/jsx-runtime.ts
import { Div } from './structures/components';
import { BaseLayer } from './structures/components';

/**
 * JSX createElement factory for LazyCanvas components
 * Compatible with "jsx": "react" in tsconfig.json
 */
export function createElement(
    type: any,
    props: any | null,
    ...children: any[]
): any {
    // Handle null props
    const allProps = props || {};

    // Flatten and filter children
    const flatChildren = children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false);

    // Extract special props
    const { ref, children: propsChildren, ...restProps } = allProps;

    // Merge children from props and arguments
    const allChildren = [
        ...(Array.isArray(propsChildren) ? propsChildren : propsChildren ? [propsChildren] : []),
        ...flatChildren
    ].filter(Boolean);

    let instance: any;

    // Handle different component types
    if (typeof type === 'string') {
        // Intrinsic elements (e.g., 'group', 'morph', etc.)
        if (type === 'group') {
            instance = createGroupInstance(restProps, allChildren);
        } else {
            throw new Error(`JSX: Unknown intrinsic element type: ${type}`);
        }
    } else if (typeof type === 'function') {
        // Check if it's a class component (has prototype with methods)
        if (type.prototype && (type.prototype.draw || type.prototype instanceof BaseLayer)) {
            // Class component (Layer classes)
            instance = createLayerInstance(type, restProps, allChildren);
        } else {
            // Functional component
            return type({ ...restProps, children: allChildren });
        }
    } else {
        throw new Error(`JSX: Invalid component type: ${typeof type}`);
    }

    // Handle ref
    if (ref) {
        if (typeof ref === 'function') {
            ref(instance);
        } else if (ref && typeof ref === 'object' && 'current' in ref) {
            ref.current = instance;
        }
    }

    return instance;
}

/**
 * Create a Group instance
 */
function createGroupInstance(props: any, children: any[]): Div {
    const { id, visible, zIndex, ...otherProps } = props;

    const group = new Div({
        id,
        visible,
        zIndex
    });

    // Add children to group
    if (children.length > 0) {
        group.add(...children);
    }

    return group;
}

/**
 * Create a Layer instance (MorphLayer, TextLayer, etc.)
 */
function createLayerInstance(LayerClass: any, props: any, children: any[]): any {
    // Extract misc props that go to the second constructor parameter
    const { id, visible, zIndex, ...layerProps } = props;

    const misc: any = {};
    if (id !== undefined) misc.id = id;
    if (visible !== undefined) misc.visible = visible;
    if (zIndex !== undefined) misc.zIndex = zIndex;

    // Create instance
    // Most layers have constructor(props, misc)
    const instance = new LayerClass(layerProps, misc);

    // Some layers might support children (like custom composite layers)
    if (children.length > 0 && instance.add && typeof instance.add === 'function') {
        instance.add(...children);
    }

    return instance;
}

/**
 * Fragment component for grouping elements without creating a Group layer
 */
export function Fragment(props: { children: any[] }): any[] {
    return props.children;
}

/**
 * Export for compatibility with some JSX runtimes
 */
export const jsx = createElement;
export const jsxs = createElement;
export const jsxDEV = createElement;

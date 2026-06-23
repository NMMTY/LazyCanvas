import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type ComponentType,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import {
  Scene as LazyScene,
  createElement,
  Fragment,
  Div,
  Signal,
  type ThreadGenerator,
  type ICanvasAdapter,
  type ICanvas,
} from "@nmmty/lazycanvas";
import { BrowserCanvasAdapter } from "@nmmty/adapter-browser";

// ---------------------------------------------------------------------------
// LazyCanvas layer class registry
// ---------------------------------------------------------------------------

interface LayerMeta {
  classRef: any;
  component?: React.ComponentType<any>;
}

const LAYER_REGISTRY: Record<string, LayerMeta> = {};

/**
 * Marker symbol to identify wrapper components created by `layerComponent`.
 */
const LAZY_LAYER_CLASS = Symbol.for("@nmmty/lazycanvas-react:layerClass");

/**
 * Register a LazyCanvas layer class for use in JSX.
 * Returns a React component wrapper that can be used directly.
 *
 * @example
 * ```tsx
 * import { registerLayer } from "@nmmty/lazycanvas-react";
 * import { MorphLayer, TextLayer } from "@nmmty/lazycanvas";
 *
 * const Morph = registerLayer("MorphLayer", MorphLayer);
 * const Text = registerLayer("TextLayer", TextLayer);
 *
 * // Use in JSX:
 * <Morph color="#ff0000" size={{ width: 200, height: 100 }} />
 * ```
 */
export function registerLayer<T extends Record<string, any>>(
  name: string,
  LayerClass: new (props?: T, misc?: any) => any,
): React.ComponentType<T> {
  if (!LAYER_REGISTRY[name]) {
    const component = createLayerComponent(LayerClass, name);
    LAYER_REGISTRY[name] = { classRef: LayerClass, component };
  }
  return LAYER_REGISTRY[name].component!;
}

/**
 * Create a React component wrapper around a LazyCanvas layer class.
 * The wrapper stores props and attaches a `__lazyLayerClass` marker so that
 * the Scene's tree converter can instantiate the real layer.
 *
 * @example
 * ```tsx
 * import { layerComponent } from "@nmmty/lazycanvas-react";
 * import { MorphLayer } from "@nmmty/lazycanvas";
 *
 * const Morph = layerComponent(MorphLayer);
 *
 * // Use in JSX:
 * <Morph color="#ff0000" size={{ width: 200, height: 100 }} />
 * ```
 */
export function createLayerComponent<T extends Record<string, any>>(
  LayerClass: new (props?: T, misc?: any) => any,
  displayName?: string,
): React.ComponentType<T & { children?: React.ReactNode }> {
  const Wrapper = forwardRef<any, T & { children?: React.ReactNode }>((props, ref) => {
    return React.createElement(LayerComponentInner, {
      layerClass: LayerClass,
      layerProps: props,
      forwardedRef: ref,
    }) as any;
  }) as ForwardRefExoticComponent<T & { children?: React.ReactNode } & RefAttributes<any>> & {
    [LAZY_LAYER_CLASS]: any;
  };

  const name = displayName || LayerClass.name || "LazyLayer";
  Wrapper.displayName = name;
  (Wrapper as any)[LAZY_LAYER_CLASS] = LayerClass;

  return Wrapper as React.FC<T>;
}

/**
 * Internal component that stores layer data for tree traversal.
 */
function LayerComponentInner({
  layerClass,
  layerProps,
  forwardedRef,
}: {
  layerClass: any;
  layerProps: any;
  forwardedRef: any;
}) {
  // This component never renders visible DOM.
  // Its props are read by the Scene's createElementTree via the marker.
  return null;
}

/**
 * Check if a React component type is a LazyCanvas layer wrapper.
 */
function getLayerClass(type: any): any {
  if (!type) return null;
  if (type[LAZY_LAYER_CLASS]) return type[LAZY_LAYER_CLASS];
  if (typeof type === "function" && type.displayName) {
    const meta = LAYER_REGISTRY[type.displayName];
    if (meta) return meta.classRef;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scene context
// ---------------------------------------------------------------------------

export interface SceneContextValue {
  scene: LazyScene | null;
  canvas: ICanvas | null;
  adapter: ICanvasAdapter;
}

const SceneContext = createContext<SceneContextValue>({
  scene: null,
  canvas: null,
  adapter: null as any,
});

/**
 * Hook to access the Scene context from child components.
 */
export function useScene(): SceneContextValue {
  return useContext(SceneContext);
}

// ---------------------------------------------------------------------------
// Tree conversion: React elements → LazyCanvas instances
// ---------------------------------------------------------------------------

function createElementTree(
  element: React.ReactElement | React.ReactElement[] | null,
  adapter: ICanvasAdapter,
): any {
  if (!element) return null;

  if (Array.isArray(element)) {
    return element
      .map((el) => createElementTree(el, adapter))
      .filter(Boolean);
  }

  if (!React.isValidElement(element)) {
    return null;
  }

  const { type, props } = element;
  const elementProps = props || {};
  const elementChildren = (elementProps as any).children;

  // Fragment
  if (type === React.Fragment) {
    const childArray = React.Children.toArray(elementChildren);
    return childArray
      .map((child) => (React.isValidElement(child) ? createElementTree(child, adapter) : null))
      .filter(Boolean);
  }

  // <group> intrinsic
  if (type === "group") {
    const lcChildren = React.Children.toArray(elementChildren)
      .map((child) => (React.isValidElement(child) ? createElementTree(child, adapter) : null))
      .filter(Boolean);
    const { children: _, ...groupProps } = elementProps as any;
    return createElement("group", groupProps, ...lcChildren);
  }

  const LayerClass = getLayerClass(type);
  if (LayerClass) {
    return instantiateLayer(LayerClass, elementProps, elementChildren, adapter);
  }

  // Function / class component
  if (typeof type === "function") {
    // 1. Check marker on wrapper component
    const LayerClass = getLayerClass(type);
    if (LayerClass) {
      return instantiateLayer(LayerClass, elementProps, elementChildren, adapter);
    }

    // 2. Check registry by display name
    const name =
      (type as any).displayName || (type as any).name || "";
    const meta = LAYER_REGISTRY[name];
    if (meta) {
      return instantiateLayer(meta.classRef, elementProps, elementChildren, adapter);
    }

    // 3. Unknown component — skip silently (DOM components like <div>, <span>, etc.)
    return null;
  }

  return null;
}

function instantiateLayer(
  LayerClass: any,
  props: Record<string, any>,
  children: any,
  adapter: ICanvasAdapter,
): any {
  const { children: _c, ref: _r, ...layerProps } = props;
  const instance = new LayerClass(layerProps, {});

  if (children) {
    const lcChildren = React.Children.toArray(children)
      .map((child) => (React.isValidElement(child) ? createElementTree(child, adapter) : null))
      .filter(Boolean);
    if (lcChildren.length > 0 && instance.add) {
      instance.add(...lcChildren);
    }
  }

  return instance;
}

// ---------------------------------------------------------------------------
// Scene component
// ---------------------------------------------------------------------------

export type AnimationFactory = () => ThreadGenerator;

export interface SceneRef {
  renderFrame(time: number): Promise<void>;
  playAnimation(signal: Signal<any>, generatorOrFactory: any): void;
  addAnimation(generatorOrFactory: any): void;
  clearAnimations(): void;
  resetTimeline(): void;
  getLayer(id: string): any | undefined;
  readonly scene: LazyScene | null;
}

export interface SceneProps {
  width: number;
  height: number;
  children: ReactNode;
  adapter?: ICanvasAdapter;
  className?: string;
  style?: React.CSSProperties;
  onReady?: (scene: LazyScene, canvas: ICanvas) => void;
  onFrame?: (scene: LazyScene) => void;
  autoRender?: boolean;
  /** false = single render, true = infinite loop, number = duration in seconds */
  animated?: boolean | number;
  debug?: boolean;
}

export const Scene = forwardRef<SceneRef, SceneProps>(function Scene(
  {
    width,
    height,
    children,
    adapter,
    className,
    style,
    onReady,
    onFrame,
    autoRender = true,
    animated = false,
    debug = false,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LazyScene | null>(null);
  const adapterRef = useRef<ICanvasAdapter>(adapter as ICanvasAdapter);
  const childrenRef = useRef<ReactNode>(children);
  childrenRef.current = children;
  const animatedRef = useRef(animated);
  animatedRef.current = animated;

  // Stores registered animation factories for replaying on loop
  type AnimEntry = { signal: Signal<any>; factory: () => ThreadGenerator };
  const animEntriesRef = useRef<AnimEntry[]>([]);
  const origPlayRef = useRef<(signal: any, gen: any) => void>(() => {});
  const origAddRef = useRef<(gen: any) => void>(() => {});

  function flushAnimations() {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.clearAnimations();
    scene.resetTimeline();
    for (const entry of animEntriesRef.current) {
      if (entry.signal) {
        origPlayRef.current(entry.signal, entry.factory());
      } else {
        origAddRef.current(entry.factory());
      }
    }
  }

  useImperativeHandle(ref, () => ({
    get scene() {
      return sceneRef.current;
    },
    renderFrame(time: number) {
      if (!sceneRef.current) return Promise.resolve();
      return sceneRef.current.renderFrame(time);
    },
    playAnimation(signal: Signal<any>, genOrFactory: any) {
      const factory = typeof genOrFactory === "function" ? genOrFactory : () => genOrFactory;
      animEntriesRef.current.push({ signal, factory });
      origPlayRef.current(signal, factory());
    },
    addAnimation(genOrFactory: any) {
      const factory = typeof genOrFactory === "function" ? genOrFactory : () => genOrFactory;
      animEntriesRef.current.push({ signal: null as any, factory });
      origAddRef.current(factory());
    },
    clearAnimations() {
      animEntriesRef.current = [];
      sceneRef.current?.clearAnimations();
    },
    resetTimeline() {
      sceneRef.current?.resetTimeline();
    },
    getLayer(id: string) {
      return sceneRef.current?.getLayer(id);
    },
  }));

  const [contextValue, setContextValue] = useState<SceneContextValue>({
    scene: null,
    canvas: null,
    adapter: adapterRef.current,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!adapterRef.current) {
      adapterRef.current = new BrowserCanvasAdapter(canvasRef.current);
    }
    const sc = new LazyScene(width, height, { adapter: adapterRef.current, debug });
    sceneRef.current = sc;

    // Intercept playAnimation/addAnimation on the raw scene so factories are tracked
    const origPlay = sc.playAnimation.bind(sc);
    const origAdd = sc.addAnimation.bind(sc);
    origPlayRef.current = origPlay;
    origAddRef.current = origAdd;
    sc.playAnimation = (signal: any, genOrFactory: any) => {
      const factory = typeof genOrFactory === "function" ? genOrFactory : () => genOrFactory;
      animEntriesRef.current.push({ signal, factory });
      origPlay(signal, factory());
    };
    sc.addAnimation = (genOrFactory: any) => {
      const factory = typeof genOrFactory === "function" ? genOrFactory : () => genOrFactory;
      animEntriesRef.current.push({ signal: null as any, factory });
      origAdd(factory());
    };

    setContextValue({
      scene: sc,
      canvas: sc.lazyCanvas.canvas,
      adapter: adapterRef.current,
    });
    onReady?.(sc, sc.lazyCanvas.canvas);
    return () => {
      sceneRef.current = null;
      sc.clearAnimations();
    };
  }, [width, height]);

  useEffect(() => {
    if (!autoRender) return;

    const scene = sceneRef.current;
    if (!scene) return;

    let isCancelled = false;
    let rafId: number | null = null;

    const buildAndRenderTree = async () => {
      const layoutManager = scene.lazyCanvas.manager.layout;

      if (layoutManager && layoutManager.ready) {
        await layoutManager.ready;
      }

      if (isCancelled) return;

      const tree = createElementTree(
        React.createElement(React.Fragment, null, childrenRef.current),
        adapterRef.current,
      );

      scene.lazyCanvas.manager.layers.clear();

      if (tree) {
        if (Array.isArray(tree)) {
          for (const layer of tree) {
            if (layer && typeof layer === "object" && "id" in layer) {
              scene.load(layer);
            }
          }
        } else if (typeof tree === "object" && "id" in tree) {
          scene.load(tree);
        }
      }

      if (scene.lazyCanvas.manager.layers.size() > 0) {
        try {
          await scene.renderFrame(0);
          if (!isCancelled) {
            onFrame?.(scene);
          }
        } catch (err) {
          console.error("[Scene] renderFrame error:", err);
        }
      }
    };

    buildAndRenderTree().then(() => {
      if (isCancelled) return;
      const animOpt = animatedRef.current;
      if (!animOpt) return;

      const maxLoops = typeof animOpt === "number" ? animOpt : Infinity;
      let loopCount = 0;
      let lastSchedulerEmpty = true;
      let animStartTime = performance.now();

      const animate = () => {
        if (isCancelled) return;

        const sc = sceneRef.current;
        if (!sc) return;

        const hasThreads = typeof (sc as any).hasActiveAnimations === "function"
          ? (sc as any).hasActiveAnimations()
          : false;

        // Restart when all generators finish
        if (!hasThreads && !lastSchedulerEmpty && animEntriesRef.current.length > 0) {
          loopCount++;
          if (loopCount >= maxLoops) return;
          flushAnimations();
          animStartTime = performance.now();
        }
        lastSchedulerEmpty = !hasThreads;

        const elapsed = (performance.now() - animStartTime) / 1000;
        sc.renderFrame(elapsed).then(() => {
          if (!isCancelled) {
            onFrame?.(sc);
            rafId = requestAnimationFrame(animate);
          }
        }).catch(() => {
          if (!isCancelled) rafId = requestAnimationFrame(animate);
        });
      };
      rafId = requestAnimationFrame(animate);
    });

    return () => {
      isCancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [autoRender, onFrame, animated]);

  return (
    <SceneContext.Provider value={contextValue}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={className}
        style={style}
      />
    </SceneContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// Pre-made wrappers for built-in layers
// ---------------------------------------------------------------------------

import {
  MorphLayer,
  TextLayer,
  ImageLayer,
  LineLayer,
  BezierLayer,
  QuadraticLayer,
  PolygonLayer,
  Path2DLayer,
} from "@nmmty/lazycanvas";

export const Morph = createLayerComponent(MorphLayer, "MorphLayer");
export const Text = createLayerComponent(TextLayer, "TextLayer");
export const Image = createLayerComponent(ImageLayer, "ImageLayer");
export const Line = createLayerComponent(LineLayer, "LineLayer");
export const Bezier = createLayerComponent(BezierLayer, "BezierLayer");
export const Quadratic = createLayerComponent(QuadraticLayer, "QuadraticLayer");
export const Polygon = createLayerComponent(PolygonLayer, "PolygonLayer");
export const Path2D = createLayerComponent(Path2DLayer, "Path2DLayer");
export const Group = createLayerComponent(Div, "Group");

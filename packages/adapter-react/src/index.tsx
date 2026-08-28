import { BrowserCanvasAdapter } from "@nmmty/adapter-browser";
import {
  Div,
  type ICanvas,
  type ICanvasAdapter,
  Scene as LazyScene,
  type Signal,
  type ThreadGenerator,
  createElement,
} from "@nmmty/lazycanvas";
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
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";

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
  // The component never renders DOM: `createElementTree` reads the marker below
  // and instantiates the real layer from the element's props.
  const Wrapper = forwardRef<any, T & { children?: React.ReactNode }>(
    () => null,
  ) as ForwardRefExoticComponent<T & { children?: React.ReactNode } & RefAttributes<any>> & {
    [LAZY_LAYER_CLASS]: any;
  };

  const name = displayName || LayerClass.name || "LazyLayer";
  Wrapper.displayName = name;
  (Wrapper as any)[LAZY_LAYER_CLASS] = LayerClass;

  return Wrapper as React.FC<T>;
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
    return element.map((el) => createElementTree(el, adapter)).filter(Boolean);
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

  // Function / class component: look it up in the registry by display name.
  // Anything unknown (plain DOM elements and user components) is skipped.
  if (typeof type === "function") {
    const name = (type as any).displayName || (type as any).name || "";
    const meta = LAYER_REGISTRY[name];
    if (meta) {
      return instantiateLayer(meta.classRef, elementProps, elementChildren, adapter);
    }
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
  const adapterRef = useRef<ICanvasAdapter | null>(adapter ?? null);

  // Callbacks are read through refs so that a new inline function on every
  // parent render does not tear down the scene or restart the animation loop.
  const onReadyRef = useRef(onReady);
  const onFrameRef = useRef(onFrame);
  onReadyRef.current = onReady;
  onFrameRef.current = onFrame;

  // Stores registered animation factories so a loop can replay them.
  type AnimEntry = { signal: Signal<any> | null; factory: () => ThreadGenerator };
  const animEntriesRef = useRef<AnimEntry[]>([]);
  const origPlayRef = useRef<(signal: any, gen: any) => void>(() => {});
  const origAddRef = useRef<(gen: any) => void>(() => {});

  // Bumped whenever a new LazyScene instance exists, so the render effects
  // below re-run against it.
  const [sceneGeneration, setSceneGeneration] = useState(0);

  const [contextValue, setContextValue] = useState<SceneContextValue>({
    scene: null,
    canvas: null,
    adapter: adapterRef.current as ICanvasAdapter,
  });

  const flushAnimations = useCallback(() => {
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
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      get scene() {
        return sceneRef.current;
      },
      renderFrame(time: number) {
        if (!sceneRef.current) return Promise.resolve();
        return sceneRef.current.renderFrame(time);
      },
      playAnimation(signal: Signal<any>, genOrFactory: any) {
        sceneRef.current?.playAnimation(signal, genOrFactory);
      },
      addAnimation(genOrFactory: any) {
        sceneRef.current?.addAnimation(genOrFactory);
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
    }),
    [],
  );

  // --- Scene lifecycle ------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvasAdapter = adapter ?? new BrowserCanvasAdapter(canvasRef.current);
    adapterRef.current = canvasAdapter;

    const sc = new LazyScene(width, height, { adapter: canvasAdapter, debug });
    sceneRef.current = sc;
    animEntriesRef.current = [];

    // Record every animation so `animated` loops can replay them from the start.
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
      animEntriesRef.current.push({ signal: null, factory });
      origAdd(factory());
    };

    setContextValue({ scene: sc, canvas: sc.lazyCanvas.canvas, adapter: canvasAdapter });
    setSceneGeneration((g) => g + 1);
    onReadyRef.current?.(sc, sc.lazyCanvas.canvas);

    return () => {
      sc.clearAnimations();
      sceneRef.current = null;
    };
  }, [width, height, adapter, debug]);

  // --- Build the layer tree and draw one frame ------------------------------
  // Depends on `children`, so updating a layer's props from React state
  // re-renders the canvas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneGeneration signals that sceneRef holds a new LazyScene, which the rule cannot see.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !autoRender) return;

    let isCancelled = false;

    (async () => {
      const layoutManager = scene.lazyCanvas.manager.layout;
      if (layoutManager?.ready) await layoutManager.ready;

      // A canvas can only use a web font once it has finished loading; drawing
      // earlier silently falls back to the browser's standard (serif) font.
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }

      // Fonts registered through the adapter itself load asynchronously too.
      const adapterRef_ = adapterRef.current as { fontsReady?: () => Promise<void> } | null;
      if (typeof adapterRef_?.fontsReady === "function") await adapterRef_.fontsReady();

      if (isCancelled) return;

      const tree = createElementTree(
        React.createElement(React.Fragment, null, children),
        adapterRef.current as ICanvasAdapter,
      );

      scene.lazyCanvas.manager.layers.clear();

      for (const layer of Array.isArray(tree) ? tree : [tree]) {
        if (layer && typeof layer === "object" && "id" in layer) scene.load(layer);
      }

      if (scene.lazyCanvas.manager.layers.size() === 0) return;

      try {
        await scene.renderFrame(0);
        if (!isCancelled) onFrameRef.current?.(scene);
      } catch (err) {
        console.error("[Scene] renderFrame error:", err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [children, autoRender, sceneGeneration]);

  // --- Animation loop -------------------------------------------------------
  // Kept separate from the tree build so that re-rendering children does not
  // restart a running animation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneGeneration signals that sceneRef holds a new LazyScene, which the rule cannot see.
  useEffect(() => {
    if (!autoRender || !animated) return;

    let isCancelled = false;
    let rafId: number | null = null;

    const maxLoops = typeof animated === "number" ? animated : Number.POSITIVE_INFINITY;
    let loopCount = 0;
    let lastSchedulerEmpty = true;
    let animStartTime = performance.now();

    const animate = () => {
      if (isCancelled) return;

      const sc = sceneRef.current;
      if (!sc) return;

      const hasThreads = sc.hasActiveAnimations();

      // All generators finished — replay them if we still have loops left.
      if (!hasThreads && !lastSchedulerEmpty && animEntriesRef.current.length > 0) {
        loopCount++;
        if (loopCount >= maxLoops) return;
        flushAnimations();
        animStartTime = performance.now();
      }
      lastSchedulerEmpty = !hasThreads;

      if (sc.lazyCanvas.manager.layers.size() === 0) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (performance.now() - animStartTime) / 1000;
      sc.renderFrame(elapsed)
        .then(() => {
          if (isCancelled) return;
          onFrameRef.current?.(sc);
          rafId = requestAnimationFrame(animate);
        })
        .catch(() => {
          if (!isCancelled) rafId = requestAnimationFrame(animate);
        });
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [autoRender, animated, sceneGeneration, flushAnimations]);

  return (
    <SceneContext.Provider value={contextValue}>
      <canvas ref={canvasRef} width={width} height={height} className={className} style={style} />
    </SceneContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// Pre-made wrappers for built-in layers
// ---------------------------------------------------------------------------

import {
  BezierLayer,
  ImageLayer,
  LineLayer,
  MorphLayer,
  Path2DLayer,
  PolygonLayer,
  QuadraticLayer,
  TextLayer,
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

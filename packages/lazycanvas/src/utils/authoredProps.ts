/**
 * Props that the layout pass overwrites on a layer.
 */
export const LAYOUT_MANAGED_PROPS = ["position", "size", "centring"] as const;

/**
 * Where the authored snapshot is stored on a layer. A symbol so it never shows
 * up in `Object.keys`, `JSON.stringify` or a spread of the layer.
 */
const AUTHORED = Symbol.for("lazycanvas.authoredProps");

interface WithProps {
  props?: Record<string, any>;
}

/**
 * Records the layout-managed props exactly as the caller wrote them, the first
 * time a layer is seen by the layout pass. Does nothing afterwards.
 *
 * The layout pass writes Yoga's computed geometry straight into `props`,
 * because that is what layers read when drawing. Keeping the author's input
 * around is what lets a later pass recompute from the same starting point, and
 * lets serialization report what the user actually set.
 *
 * @param {WithProps} [layer] - The layer to snapshot.
 */
export function captureAuthoredProps(layer: WithProps): void {
  const props = layer.props;
  if (!props) return;
  if ((layer as any)[AUTHORED] !== undefined) return;

  const snapshot: Record<string, any> = {};
  for (const key of LAYOUT_MANAGED_PROPS) {
    if (key in props) snapshot[key] = structuredClone(props[key]);
  }
  (layer as any)[AUTHORED] = snapshot;
}

/**
 * Restores the authored values of the layout-managed props.
 *
 * Only call this for layers the layout pass is about to overwrite. Layers that
 * sit outside the flex flow keep whatever is in `props` — that is where a
 * signal-driven position lives, and resetting it would freeze the animation.
 *
 * @param {WithProps} [layer] - The layer to reset.
 */
export function restoreAuthoredProps(layer: WithProps): void {
  const props = layer.props;
  const captured = (layer as any)[AUTHORED] as Record<string, any> | undefined;
  if (!props || captured === undefined) return;

  for (const key of LAYOUT_MANAGED_PROPS) {
    if (key in captured) props[key] = structuredClone(captured[key]);
    else delete props[key];
  }
}

/**
 * The value a prop was authored with, falling back to its current value when
 * the layer has never been through the layout pass.
 *
 * @param {WithProps} [layer] - The layer to read.
 * @param {string} [key] - The prop name.
 * @returns {any} The authored value.
 */
export function authoredProp(layer: WithProps, key: string): any {
  const captured = (layer as any)[AUTHORED] as Record<string, any> | undefined;
  if (captured && key in captured) return captured[key];
  if (captured) return undefined;
  return layer.props?.[key];
}

/**
 * Props as the caller wrote them: the current props with any layout-computed
 * values swapped back for the authored ones, and the internal layout marker
 * removed.
 *
 * @param {WithProps} [layer] - The layer to read.
 * @returns {Record<string, any>} Props safe to serialize.
 */
export function authoredProps<T extends Record<string, any>>(layer: WithProps): T {
  const props = (layer.props ?? {}) as Record<string, any>;
  const captured = (layer as any)[AUTHORED] as Record<string, any> | undefined;

  if (!captured) return props as T;

  const result: Record<string, any> = { ...props };
  for (const key of LAYOUT_MANAGED_PROPS) {
    if (key in captured) result[key] = captured[key];
    else delete result[key];
  }
  // biome-ignore lint/performance/noDelete: internal layout marker must not be serialized.
  delete result._computedLayout;
  return result as T;
}

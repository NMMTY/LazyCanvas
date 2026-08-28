import type { IOLazyCanvas, LazyCanvas } from "../LazyCanvas";
import type { LayersManager } from "../managers";

/**
 * Serializes every layer of a manager into its plain JSON representation.
 *
 * Pure helper with no filesystem or platform dependencies, so it is safe to use
 * in browser bundles. Shared by {@link Pattern} and the Node-only `Exporter`.
 *
 * @param {LayersManager} [manager] - The manager whose layers should be serialized.
 * @returns {object[]} The JSON representation of every layer.
 */
export function serializeLayers(manager: LayersManager): object[] {
  return manager.toArray().map((layer) => layer.toJSON());
}

/**
 * Serializes a whole canvas (options + layers) into a plain object that can be
 * fed back into `JSONReader.read`.
 *
 * @param {LazyCanvas} [canvas] - The canvas to serialize.
 * @returns {IOLazyCanvas} The JSON representation of the canvas.
 */
export function serializeCanvas(canvas: LazyCanvas): IOLazyCanvas {
  return {
    options: canvas.options,
    layers: serializeLayers(canvas.manager.layers) as IOLazyCanvas["layers"],
  };
}

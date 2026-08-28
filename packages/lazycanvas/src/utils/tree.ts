import type { Div } from "../structures/components";
import type { AnyLayer } from "../types";

/**
 * Any node of a layer tree.
 */
export type LayerNode = AnyLayer | Div;

/**
 * Returns the children of a layer.
 *
 * Every layer stores its subtree in `children` (`Div.layers` is an alias of the
 * same array). Going through this helper keeps traversal working for plain
 * objects too, such as layers restored from JSON.
 *
 * @param {LayerNode} [layer] - The layer to read children from.
 * @returns {LayerNode[]} The children, or an empty array when there are none.
 */
export function getChildren(layer: LayerNode): LayerNode[] {
  const children = (layer as { children?: unknown }).children;
  return Array.isArray(children) ? (children as LayerNode[]) : [];
}

/**
 * Depth-first iteration over a layer and all of its descendants.
 *
 * @param {LayerNode | LayerNode[]} [roots] - The root layer(s) to walk.
 * @returns {Generator<LayerNode>} Every layer of the tree, parents before children.
 */
export function* walkLayers(roots: LayerNode | LayerNode[]): Generator<LayerNode> {
  const stack: LayerNode[] = Array.isArray(roots) ? [...roots].reverse() : [roots];

  while (stack.length > 0) {
    const layer = stack.pop()!;
    yield layer;
    const children = getChildren(layer);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
}

/**
 * Recursively searches a layer tree for a layer with the given id.
 *
 * @param {LayerNode | LayerNode[]} [roots] - The root layer(s) to search.
 * @param {string} [id] - The id to look for.
 * @returns {LayerNode | undefined} The matching layer, or undefined if absent.
 */
export function findLayer(roots: LayerNode | LayerNode[], id: string): LayerNode | undefined {
  for (const layer of walkLayers(roots)) {
    if (layer.id === id) return layer;
  }
  return undefined;
}

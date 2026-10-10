import type { AnyLayer } from "../../../types";
import { getChildren, throwFirst } from "../../../utils";
import { Group } from "../../components";
import { BaseRenderPipeline } from "./BaseRenderPipeline";

/**
 * Default render pipeline. Runs the flexbox layout pass over every root layer
 * and renders the full layer hierarchy, translating the context into each
 * parent's coordinate space before drawing its children.
 */
export class ModernRenderPipeline extends BaseRenderPipeline {
  /**
   * Draws a layer and its subtree. A layer that fails does not stop the ones
   * after it: the error is recorded in `errors` and drawing carries on.
   */
  private async renderLayer(layer: AnyLayer | Group, errors: unknown[]): Promise<void> {
    if (!layer.visible) return;

    try {
      await this.drawLayer(layer);
    } catch (error) {
      errors.push(error);
    }

    // `Group` draws its own children inside `Group.draw`, so descending here too
    // would render them twice.
    const children = layer instanceof Group ? [] : getChildren(layer);
    if (children.length === 0) return;

    const ctx = this.lazyCanvas.ctx;
    ctx.save();
    try {
      const position = layer.props?.position;
      if (position) {
        const x = typeof position.x === "number" ? position.x : 0;
        const y = typeof position.y === "number" ? position.y : 0;
        ctx.translate(x, y);
      }

      for (const child of children) {
        await this.renderLayer(child, errors);
      }
    } finally {
      ctx.restore();
    }
  }

  protected async renderTree(): Promise<void> {
    // Rendering is intentionally not blocked on yoga-layout initialization:
    // `calculateLayout` is a no-op while yoga is still loading and the layout
    // is applied on the next frame instead.
    const rootLayers = this.lazyCanvas.manager.layers.toArray().filter((l) => !l.parent);

    for (const layer of rootLayers) {
      this.lazyCanvas.manager.layout.calculateLayout(
        layer,
        this.lazyCanvas.options.width,
        this.lazyCanvas.options.height,
        this.lazyCanvas.ctx,
        this.lazyCanvas.canvas,
      );
    }

    const errors: unknown[] = [];
    for (const layer of rootLayers) {
      await this.renderLayer(layer, errors);
    }

    // The frame is complete; now report what went wrong while drawing it.
    throwFirst(errors);
  }
}

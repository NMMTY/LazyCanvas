import { BaseRenderPipeline } from "./BaseRenderPipeline";

/**
 * Legacy render pipeline kept for backwards compatibility with pre-1.0 code.
 *
 * It draws the flat list of layers held by the {@link LayersManager} in z-index
 * order and **does not** run the flexbox layout pass or descend into a layer's
 * `children`. Use {@link ModernRenderPipeline} (the default for `Scene`) unless
 * you specifically need the old positioning behaviour.
 *
 * @deprecated Prefer `ModernRenderPipeline`; this pipeline ignores `layout` props.
 */
export class ClassicRenderPipeline extends BaseRenderPipeline {
  protected async renderTree(): Promise<void> {
    for (const layer of this.lazyCanvas.manager.layers.toArray()) {
      await this.drawLayer(layer);
    }
  }
}

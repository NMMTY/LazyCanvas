export * from "./structures/LazyCanvas";
export * from "./structures/managers";
export * from "./structures/components";
export * from "./structures/helpers";
export * from "./types";
export * from "./helpers";
export * from "./core";

// Only the helpers that are meant for application and adapter code; the rest
// of ./utils (draw helpers, layout bookkeeping, parsers) is internal.
export { LazyError } from "./utils/LazyUtil";
export {
  DEFAULT_FONT_FALLBACK,
  collectFontSpecs,
  cssFont,
  cssFontFamily,
} from "./utils/font";
export { type LayerNode, findLayer, getChildren, walkLayers } from "./utils/tree";
export { type Path2DConstructor, registerPath2D } from "./utils/path2d";
export {
  type VerticalTextLayout,
  type VerticalTextOptions,
  type VerticalTextUnit,
  canvasDirection,
  isVerticalDirection,
  layoutVerticalText,
} from "./utils/verticalText";

export * from "./jsx-runtime";

// Node-only APIs (Exporter, APNGEncoder, file readers) live in the
// "@nmmty/lazycanvas/node" entry point so that this one stays bundler-safe.

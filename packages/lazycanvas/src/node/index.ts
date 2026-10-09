/**
 * Node.js-only entry point of LazyCanvas: `@nmmty/lazycanvas/node`.
 *
 * Everything exported here depends on Node built-ins (`node:fs`, `node:zlib`)
 * and is therefore kept out of the main entry point so that browser bundlers do
 * not have to polyfill or stub them.
 */
export * from "./APNGEncoder";
export * from "./Exporter";
export * from "./readers";

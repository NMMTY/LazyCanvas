import { LazyError } from "./LazyUtil";

/**
 * Constructor signature shared by the browser's `Path2D` and the one shipped
 * with `@napi-rs/canvas`.
 */
export type Path2DConstructor = new (path?: any) => any;

let registered: Path2DConstructor | undefined;

/**
 * Registers the `Path2D` implementation to use when no adapter is available at
 * the call site. `LazyCanvas` calls this with its adapter's implementation, so
 * layers created before or without a canvas still work.
 *
 * @param {Path2DConstructor} [ctor] - The implementation to register.
 */
export function registerPath2D(ctor?: Path2DConstructor): void {
  if (ctor) registered = ctor;
}

/**
 * Resolves a usable `Path2D` implementation.
 *
 * Node has no global `Path2D`, so the adapter's implementation is preferred,
 * falling back to the last registered one and finally to the global.
 *
 * @param {object} [adapter] - An adapter that may carry a `Path2D` implementation.
 * @returns {Path2DConstructor | undefined} The implementation, if any is available.
 */
export function resolvePath2D(adapter?: { Path2D?: any }): Path2DConstructor | undefined {
  return adapter?.Path2D ?? registered ?? (globalThis as any).Path2D;
}

/**
 * Creates a `Path2D`, optionally from an SVG path string.
 *
 * @param {string} [path] - An SVG path definition.
 * @param {object} [adapter] - Adapter to take the implementation from.
 * @returns {any} The created path.
 * @throws {LazyError} If no `Path2D` implementation is available.
 */
export function createPath2D(path?: string, adapter?: { Path2D?: any }): any {
  const Ctor = resolvePath2D(adapter);
  if (!Ctor) {
    throw new LazyError(
      "No Path2D implementation available. Node has no global Path2D — create the " +
        "LazyCanvas/Scene with an adapter (e.g. NodeCanvasAdapter) before using Path2DLayer.",
    );
  }
  return path === undefined ? new Ctor() : new Ctor(path);
}

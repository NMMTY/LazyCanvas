import { Canvas } from "@napi-rs/canvas";

/**
 * happy-dom has no 2D context, so each <canvas> element is backed by a real
 * @napi-rs/canvas surface: the scene draws pixels we can read back.
 */
const surfaces = new WeakMap<HTMLCanvasElement, Canvas>();

export function surfaceOf(element: HTMLCanvasElement): Canvas {
  let surface = surfaces.get(element);
  if (!surface || surface.width !== element.width || surface.height !== element.height) {
    surface = new Canvas(element.width || 300, element.height || 150);
    surfaces.set(element, surface);
  }
  return surface;
}

export function installCanvasSurfaces(): void {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value(this: HTMLCanvasElement) {
      const ctx = surfaceOf(this).getContext("2d") as unknown as {
        drawImage: (image: unknown, ...rest: unknown[]) => void;
        __unwrapsCanvases?: boolean;
      };
      if (!ctx.__unwrapsCanvases) {
        // A scene copies its back buffer onto the visible canvas with drawImage(<canvas>),
        // which napi-rs only understands when given its own surface.
        const drawImage = ctx.drawImage.bind(ctx);
        ctx.drawImage = (image, ...rest) =>
          drawImage(image instanceof HTMLCanvasElement ? surfaceOf(image) : image, ...rest);
        ctx.__unwrapsCanvases = true;
      }
      return ctx;
    },
  });
}

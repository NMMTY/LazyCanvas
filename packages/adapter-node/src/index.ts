import {
  Canvas,
  GlobalFonts,
  Path2D as NapiPath2D,
  loadImage as napiLoadImage,
} from "@napi-rs/canvas";
import type { ICanvas, ICanvasAdapter, IFontsAdapter, ImageSource } from "@nmmty/lazycanvas";

/**
 * Node.js adapter for LazyCanvas using @napi-rs/canvas.
 * Provides canvas creation, font management, and image loading for Node.js environments.
 */
export class NodeCanvasAdapter implements ICanvasAdapter {
  fonts: IFontsAdapter = {
    registerFromPath: (path: string, family: string): boolean => {
      try {
        return GlobalFonts.registerFromPath(path, family) !== null;
      } catch {
        return false;
      }
    },
    register: (source: string, family: string): boolean => {
      try {
        const buffer = Buffer.from(source, "base64");
        return GlobalFonts.register(buffer, family) !== null;
      } catch {
        return false;
      }
    },
    has: (family: string): boolean => {
      return GlobalFonts.has(family);
    },
    get families(): string[] {
      return GlobalFonts.families.map((f: any) => (typeof f === "string" ? f : f.family || ""));
    },
  };

  createCanvas(width: number, height: number): ICanvas {
    return new Canvas(width, height) as unknown as ICanvas;
  }

  loadImage = async (src: ImageSource): Promise<any> => {
    return napiLoadImage(src as any);
  };

  /**
   * `Path2D` implementation of @napi-rs/canvas. Node has no global `Path2D`,
   * so layers must take the constructor from the adapter.
   */
  Path2D = NapiPath2D;
}

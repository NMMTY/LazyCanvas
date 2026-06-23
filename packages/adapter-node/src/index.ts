import { Canvas, GlobalFonts, loadImage as napiLoadImage, Path2D } from "@napi-rs/canvas";
import type {
  ICanvasAdapter,
  ICanvas,
  IFontsAdapter,
  ImageSource,
} from "@nmmty/lazycanvas";

/**
 * Node.js adapter for LazyCanvas using @napi-rs/canvas.
 * Provides canvas creation, font management, and image loading for Node.js environments.
 */
export class NodeCanvasAdapter implements ICanvasAdapter {
  fonts: IFontsAdapter = {
    registerFromPath: (path: string, family: string): boolean => {
      try {
        const result = GlobalFonts.registerFromPath(path, family);
        return result !== null;
      } catch {
        return false;
      }
    },
    register: (source: string, family: string): boolean => {
      try {
        const buffer = Buffer.from(source);
        const result = GlobalFonts.register(buffer, family);
        return result !== null;
      } catch {
        return false;
      }
    },
    has: (family: string): boolean => {
      return GlobalFonts.has(family);
    },
    families: GlobalFonts.families.map((f: any) =>
      typeof f === "string" ? f : f.family || "",
    ),
  };

  createCanvas(width: number, height: number): ICanvas {
    const canvas = new Canvas(width, height);
    return canvas as unknown as ICanvas;
  }

  loadImage = async (src: ImageSource): Promise<any> => {
    return napiLoadImage(src as any);
  };

  Path2D?: Path2D;
}

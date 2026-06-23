import type {
  ICanvasAdapter,
  ICanvas,
  IFontsAdapter,
  ImageSource,
} from "@nmmty/lazycanvas";

/**
 * Browser adapter for LazyCanvas using native HTMLCanvasElement.
 * Provides canvas creation, font management, and image loading for browser environments.
 */
export class BrowserCanvasAdapter implements ICanvasAdapter {
  private existingCanvas: HTMLCanvasElement | null = null;

  constructor(canvas?: HTMLCanvasElement) {
    this.existingCanvas = canvas || null;
  }

  fonts: IFontsAdapter = {
    registerFromPath: (_path: string, _family: string): boolean => {
      console.warn("registerFromPath is not supported in browser. Use CSS @font-face instead.");
      return false;
    },
    register: (source: string, family: string): boolean => {
      if (typeof FontFace !== "undefined") {
        try {
          const fontFace = new FontFace(family, `url(data:font/ttf;base64,${source})`);
          document.fonts.add(fontFace);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    has: (family: string): boolean => {
      if (typeof document !== "undefined") {
        return document.fonts.check(`16px "${family}"`);
      }
      return false;
    },
    families: typeof document !== "undefined"
      ? Array.from(document.fonts).map((f) => f.family)
      : [],
  };

  createCanvas(width: number, height: number): ICanvas {
    if (this.existingCanvas) {
      this.existingCanvas.width = width;
      this.existingCanvas.height = height;
      return this.existingCanvas as unknown as ICanvas;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as ICanvas;
  }

  loadImage = async (src: ImageSource): Promise<HTMLImageElement> => {
    if (typeof Image === "undefined") {
      throw new Error("Image constructor is not available in this environment");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));

      if (src instanceof ArrayBuffer) {
        const blob = new Blob([src]);
        img.src = URL.createObjectURL(blob);
      } else if (src instanceof Uint8Array) {
        const blob = new Blob([src.buffer as ArrayBuffer]);
        img.src = URL.createObjectURL(blob);
      } else if (typeof src === "string") {
        img.src = src;
      } else {
        // Buffer-like object - convert to data URL
        const bytes = new Uint8Array(src as any);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        img.src = `data:image/png;base64,${base64}`;
      }
    });
  };

  Path2D = typeof Path2D !== "undefined" ? Path2D : undefined;
}

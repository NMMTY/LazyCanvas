import type { ICanvas, ICanvasAdapter, IFontsAdapter, ImageSource } from "@nmmty/lazycanvas";

/**
 * Converts arbitrary binary input into a Blob the browser can load.
 */
function toBlob(src: ArrayBuffer | ArrayBufferView): Blob {
  if (src instanceof ArrayBuffer) return new Blob([src]);
  const view = src as ArrayBufferView;
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength));
  return new Blob([bytes]);
}

/**
 * Browser adapter for LazyCanvas using native HTMLCanvasElement.
 * Provides canvas creation, font management, and image loading for browser environments.
 */
export class BrowserCanvasAdapter implements ICanvasAdapter {
  private existingCanvas: HTMLCanvasElement | null = null;

  /**
   * Fonts registered by this adapter that are still loading. Await
   * {@link fontsReady} before rendering text in a freshly registered family.
   */
  private pendingFonts: Promise<unknown>[] = [];

  constructor(canvas?: HTMLCanvasElement) {
    this.existingCanvas = canvas || null;
  }

  fonts: IFontsAdapter = {
    registerFromPath: (_path: string, _family: string): boolean => {
      console.warn("registerFromPath is not supported in browser. Use CSS @font-face instead.");
      return false;
    },
    register: (source: string, family: string): boolean => {
      if (typeof FontFace === "undefined" || typeof document === "undefined") return false;
      try {
        const fontFace = new FontFace(family, `url(data:font/ttf;base64,${source})`);
        // `document.fonts.check()` and canvas text rendering only see the face
        // once it has finished loading, so kick the load off immediately and
        // track it so callers can await `fontsReady`.
        this.pendingFonts.push(
          fontFace
            .load()
            .then((loaded) => document.fonts.add(loaded))
            .catch((err) => console.warn(`Failed to load font "${family}":`, err)),
        );
        return true;
      } catch {
        return false;
      }
    },
    has: (family: string): boolean => {
      if (typeof document === "undefined") return false;
      return document.fonts.check(`16px "${family}"`);
    },
    get families(): string[] {
      if (typeof document === "undefined") return [];
      return Array.from(document.fonts).map((f) => f.family);
    },
  };

  /**
   * Resolves once every font registered through this adapter has finished
   * loading (or failed). Await it before the first text render.
   */
  async fontsReady(): Promise<void> {
    await Promise.all(this.pendingFonts);
    this.pendingFonts = [];
  }

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

    let objectUrl: string | null = null;

    if (typeof src === "string") {
      // Already a URL or data URL — nothing to allocate.
    } else if (src instanceof ArrayBuffer || ArrayBuffer.isView(src as any)) {
      objectUrl = URL.createObjectURL(toBlob(src as ArrayBuffer | ArrayBufferView));
    } else {
      throw new Error("Unsupported image source: expected a URL, ArrayBuffer or TypedArray");
    }

    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error(`Failed to load image: ${objectUrl ? "<binary>" : String(src)}`));
        img.src = objectUrl ?? (src as string);
      });
    } finally {
      // The decoded bitmap is retained by the <img>, so the blob URL can go.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  /**
   * Native browser `Path2D`, used by `Path2DLayer`.
   */
  Path2D = typeof Path2D !== "undefined" ? Path2D : undefined;
}

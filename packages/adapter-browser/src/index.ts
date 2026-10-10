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

/** How many decoded images {@link BrowserCanvasAdapter} keeps for reuse. */
const IMAGE_CACHE_LIMIT = 64;

/**
 * Images by URL, shared by every adapter. A scene is redrawn on every change and each frame asks
 * for the same avatar again; going back to the network (or at least to the decoder) for it every
 * time is most of what a redraw costs. The promise is stored, so frames that ask while the image
 * is still loading share one request. A `Map` iterates in insertion order, which makes the oldest
 * entry the first key.
 */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Font shorthands the browser has already loaded. Only a spec that matched a face is remembered:
 * an empty result can mean the `@font-face` is not declared yet, and that must be asked again.
 */
const loadedFontSpecs = new Set<string>();

/** Forgets every cached image, e.g. after the file behind a URL was replaced. */
export function clearImageCache(): void {
  imageCache.clear();
}

/** Options of {@link BrowserCanvasAdapter}. */
export interface BrowserCanvasAdapterOptions {
  /**
   * Reuse the image already loaded for a URL instead of loading it again (default `true`).
   * Turn it off if the picture behind a URL changes while the page is open.
   */
  imageCache?: boolean;
}

/**
 * Browser adapter for LazyCanvas using native HTMLCanvasElement.
 * Provides canvas creation, font management, and image loading for browser environments.
 */
export class BrowserCanvasAdapter implements ICanvasAdapter {
  private existingCanvas: HTMLCanvasElement | null = null;
  private readonly useImageCache: boolean;

  /**
   * Fonts registered by this adapter that are still loading. Await
   * {@link fontsReady} before rendering text in a freshly registered family.
   */
  private pendingFonts: Promise<unknown>[] = [];

  /**
   * @param {HTMLCanvasElement} [canvas] - A canvas to draw on. Without one, a detached canvas is
   * created, which is what to use as the back buffer of a visible canvas.
   * @param {BrowserCanvasAdapterOptions} [options] - Options.
   */
  constructor(canvas?: HTMLCanvasElement, options: BrowserCanvasAdapterOptions = {}) {
    this.existingCanvas = canvas || null;
    this.useImageCache = options.imageCache ?? true;
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

  /**
   * Makes sure the given fonts are downloaded and usable by a canvas.
   *
   * A `@font-face` declared in CSS is only fetched once something renders with
   * it, and a canvas does not count: drawing text with an unloaded family
   * silently falls back. `document.fonts.ready` does not help either — it waits
   * for fonts already being loaded, not for ones nothing has asked for yet — so
   * each family has to be requested explicitly through `document.fonts.load()`.
   *
   * Firefox shows this most clearly: the first paint uses the fallback font and
   * only a later reload, once the font is in the HTTP cache, looks right.
   *
   * @param {string[]} [specs] - Font shorthand strings, e.g. `400 16px "Geist"`.
   */
  async loadFonts(specs: string[]): Promise<void> {
    if (typeof document === "undefined" || !document.fonts) return;

    await Promise.all(
      specs
        .filter((spec) => !loadedFontSpecs.has(spec))
        .map((spec) =>
          // An unknown family rejects; that is not fatal, the layer falls back.
          document.fonts
            .load(spec)
            .then((faces) => {
              if (faces.length > 0) loadedFontSpecs.add(spec);
            })
            .catch(() => undefined),
        ),
    );
  }

  /** Returns the element given to the constructor (resized), or a new detached `<canvas>`. */
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

  loadImage = (src: ImageSource): Promise<HTMLImageElement> => {
    // Only URLs are cached: binary data has no stable identity to look it up by.
    if (!this.useImageCache || typeof src !== "string") return this.fetchImage(src);

    const cached = imageCache.get(src);
    if (cached) {
      // Move it to the end so the entry evicted first is the one used least recently.
      imageCache.delete(src);
      imageCache.set(src, cached);
      return cached;
    }

    const loading = this.fetchImage(src);
    imageCache.set(src, loading);
    if (imageCache.size > IMAGE_CACHE_LIMIT) {
      imageCache.delete(imageCache.keys().next().value as string);
    }
    // A failure must not stay cached, or a transient network error would break the image for good.
    loading.catch(() => {
      if (imageCache.get(src) === loading) imageCache.delete(src);
    });
    return loading;
  };

  private fetchImage = async (src: ImageSource): Promise<HTMLImageElement> => {
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

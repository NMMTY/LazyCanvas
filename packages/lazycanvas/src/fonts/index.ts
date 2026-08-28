/**
 * Bundled fonts: `@nmmty/lazycanvas/fonts`.
 *
 * These are ~2.7 MB of base64-encoded font data, so they live behind their own
 * entry point instead of being pulled into every bundle. Load them explicitly
 * when you want them:
 *
 * ```ts
 * import { Fonts } from "@nmmty/lazycanvas/fonts";
 *
 * canvas.manager.fonts.loadFonts(Fonts);
 * ```
 *
 * In the browser you usually do not need these at all — register the families
 * with CSS `@font-face` and refer to them by name.
 *
 * @see https://vercel.com/font
 */
export * from "./Geist";

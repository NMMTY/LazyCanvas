import localFont from "next/font/local";

/**
 * Geist and Geist Mono, loaded from the font files that ship with the
 * lazycanvas package.
 *
 * This is the recommended way to use a font on a canvas in the browser: the
 * bundled base64 data in `@nmmty/lazycanvas/fonts` exists for Node, where there
 * is no CSS. Loading them as web fonts here keeps the bundle small, and
 * `<Scene>` waits for `document.fonts.ready` before its first frame so the
 * canvas never paints with a fallback.
 */
export const geist = localFont({
  variable: "--font-geist",
  display: "block",
  src: [
    {
      path: "../../../../packages/lazycanvas/resources/fonts/Geist-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../../packages/lazycanvas/resources/fonts/Geist-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../../packages/lazycanvas/resources/fonts/Geist-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

export const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "block",
  src: [
    {
      path: "../../../../packages/lazycanvas/resources/fonts/GeistMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../../packages/lazycanvas/resources/fonts/GeistMono-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../../packages/lazycanvas/resources/fonts/GeistMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

/**
 * The family names the browser actually resolves.
 *
 * `next/font/local` generates a hashed family name per font, so a canvas has to
 * ask for that name rather than for "Geist" — `style.fontFamily` is where next
 * exposes it (already a full family list with a fallback appended).
 */
export const GEIST_FAMILY = geist.style.fontFamily;
export const GEIST_MONO_FAMILY = geistMono.style.fontFamily;

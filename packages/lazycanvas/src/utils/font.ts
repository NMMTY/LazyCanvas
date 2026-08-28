/**
 * CSS generic font families. These are keywords, not family names, so they must
 * never be quoted and never need a fallback appended.
 *
 * @see https://developer.mozilla.org/docs/Web/CSS/font-family#generic-name
 */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

/**
 * Fallback appended to a named family so that text stays legible when the
 * family is not available.
 *
 * Without one, a canvas silently falls back to the browser's *standard* font,
 * which is a serif (Times New Roman in Chrome) — so a missing web font turns
 * every label into unexpected serif text.
 */
export const DEFAULT_FONT_FALLBACK = "sans-serif";

/**
 * Renders a font family as a valid CSS `font-family` list.
 *
 * - Generic keywords are passed through untouched.
 * - A value that already contains a comma is treated as an author-supplied
 *   stack and is left alone.
 * - Anything else is quoted (so multi-word names are unambiguous) and given a
 *   fallback.
 *
 * @param {string} [family] - The family name, or a full family list.
 * @param {string} [fallback] - Fallback family list. Pass an empty string to omit it.
 * @returns {string} A CSS font-family list.
 */
export function cssFontFamily(family: string, fallback: string = DEFAULT_FONT_FALLBACK): string {
  const name = (family ?? "").trim();
  if (!name) return fallback || DEFAULT_FONT_FALLBACK;

  // Already a list, or already quoted: trust the caller.
  if (name.includes(",") || name.startsWith('"') || name.startsWith("'")) return name;

  if (GENERIC_FAMILIES.has(name.toLowerCase())) return name;

  return fallback ? `"${name}", ${fallback}` : `"${name}"`;
}

/**
 * Builds the string assigned to `ctx.font`.
 *
 * @param {object} [font] - Weight, size in pixels, and family.
 * @param {number} [sizeOverride] - Size to use instead of `font.size`.
 * @returns {string} A CSS font shorthand.
 */
export function cssFont(
  font: { family: string; size: number; weight: string | number },
  sizeOverride?: number,
): string {
  const size = sizeOverride ?? font.size;
  return `${font.weight} ${size}px ${cssFontFamily(font.family)}`;
}

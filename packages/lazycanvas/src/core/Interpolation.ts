export type Interpolator<T> = (from: T, to: T, progress: number) => T;

/**
 * Linear interpolation for numbers
 */
export function lerpNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/**
 * Parse color string to RGBA components
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    let r: number,
      g: number,
      b: number,
      a = 1;

    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
      a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    } else {
      return null;
    }

    return { r, g, b, a };
  }

  // Handle rgb/rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Handle hsl/hsla
  const hslaMatch = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
  if (hslaMatch) {
    const h = parseInt(hslaMatch[1]) / 360;
    const s = parseInt(hslaMatch[2]) / 100;
    const l = parseInt(hslaMatch[3]) / 100;
    const a = hslaMatch[4] ? parseFloat(hslaMatch[4]) : 1;

    // Convert HSL to RGB
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  return null;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

/**
 * Interpolate colors in RGB space
 */
export function lerpColorRGB(from: string, to: string, progress: number): string {
  const fromColor = parseColor(from);
  const toColor = parseColor(to);

  if (!fromColor || !toColor) {
    return progress < 0.5 ? from : to;
  }

  const r = Math.round(lerpNumber(fromColor.r, toColor.r, progress));
  const g = Math.round(lerpNumber(fromColor.g, toColor.g, progress));
  const b = Math.round(lerpNumber(fromColor.b, toColor.b, progress));
  const a = lerpNumber(fromColor.a, toColor.a, progress);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Interpolate colors in HSL space (smoother for hue transitions)
 */
export function lerpColorHSL(from: string, to: string, progress: number): string {
  const fromColor = parseColor(from);
  const toColor = parseColor(to);

  if (!fromColor || !toColor) {
    return progress < 0.5 ? from : to;
  }

  const fromHSL = rgbToHsl(fromColor.r, fromColor.g, fromColor.b);
  const toHSL = rgbToHsl(toColor.r, toColor.g, toColor.b);

  // Interpolate hue with shortest path
  let deltaH = toHSL.h - fromHSL.h;
  if (deltaH > 0.5) deltaH -= 1;
  if (deltaH < -0.5) deltaH += 1;

  const h = fromHSL.h + deltaH * progress;
  const s = lerpNumber(fromHSL.s, toHSL.s, progress);
  const l = lerpNumber(fromHSL.l, toHSL.l, progress);
  const a = lerpNumber(fromColor.a, toColor.a, progress);

  const { r, g, b } = hslToRgb(h, s, l);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Interpolate 2D vectors/points
 */
export function lerpVector(
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
): { x: number; y: number } {
  return {
    x: lerpNumber(from.x, to.x, progress),
    y: lerpNumber(from.y, to.y, progress),
  };
}

/**
 * Auto-detect interpolator based on value type
 */
export function getInterpolator<T>(from: T, to: T): Interpolator<T> {
  // Number
  if (typeof from === "number" && typeof to === "number") {
    return lerpNumber as unknown as Interpolator<T>;
  }

  // String (assume color)
  if (typeof from === "string" && typeof to === "string") {
    // Try to detect if it's a color
    if (from.startsWith("#") || from.startsWith("rgb") || from.startsWith("hsl")) {
      return lerpColorRGB as unknown as Interpolator<T>;
    }
  }

  // Vector/Point
  if (
    typeof from === "object" &&
    from !== null &&
    typeof to === "object" &&
    to !== null &&
    "x" in from &&
    "y" in from &&
    "x" in to &&
    "y" in to
  ) {
    return lerpVector as unknown as Interpolator<T>;
  }

  // Default: snap to end value
  return ((from: T, to: T, progress: number) => (progress < 1 ? from : to)) as Interpolator<T>;
}

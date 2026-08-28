import { Div, ImageLayer, LineLayer, MorphLayer, TextLayer } from "../structures/components";
import {
  type AnyTextAlign,
  type AnyWeight,
  type ColorType,
  FontWeight,
  type RadiusCorner,
  type ScaleType,
  TextAlign,
} from "../types";

const Utils = {
  grid(size: { x: number; y: number }, opts?: gridOptions): Div {
    if (size.x === undefined || size.y === undefined) {
      throw new Error("Size must have x and y properties");
    }

    const options = {
      cellWith: 10,
      cellHeight: 10,
      startX: 0,
      startY: 0,
      endX: size.x,
      endY: size.y,
      color: "rgba(0, 0, 0, 0.5)",
      lineWidth: 1,
      ...opts,
    } as gridOptionsNormalized;

    return new Div()
      .setID(
        `grid-${options.cellWith}-${options.cellHeight}-${options.startX}-${options.startY}-${options.endX}-${options.endY}`,
      )
      .add(
        ...Array.from(
          { length: Math.ceil((options.endX - options.startX) / options.cellWith) },
          (_, i) => {
            const x = options.startX + i * options.cellWith;
            return new LineLayer()
              .setPosition(x, options.startY, x, options.endY)
              .setColor(options.color)
              .setStroke(options.lineWidth);
          },
        ),
        ...Array.from(
          { length: Math.ceil((options.endY - options.startY) / options.cellHeight) },
          (_, i) => {
            const y = options.startY + i * options.cellHeight;
            return new LineLayer()
              .setPosition(options.startX, y, options.endX, y)
              .setColor(options.color)
              .setStroke(options.lineWidth);
          },
        ),
      );
  },
  box(start: { x: number; y: number }, end: { x: number; y: number }, opts?: options): Div {
    if (
      start.x === undefined ||
      start.y === undefined ||
      end.x === undefined ||
      end.y === undefined
    ) {
      throw new Error("Start and end must have x and y properties");
    }

    if (opts === undefined) opts = {};

    if (opts.color === undefined) opts.color = "rgba(0, 0, 0, 0.5)";
    if (opts.lineWidth === undefined) opts.lineWidth = 1;

    return new Div()
      .setID(`box-${start.x}-${start.y}-${end.x}-${end.y}`)
      .add(
        new LineLayer()
          .setPosition(start.x, start.y, end.x, start.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(end.x, start.y, end.x, end.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(end.x, end.y, start.x, end.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(start.x, end.y, start.x, start.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
      );
  },

  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#?([a-f\d]{3}|[a-f\d]{6})$/i);
    if (!match) return null;
    const h = match[1];
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return {
      r: Number.parseInt(full.substring(0, 2), 16),
      g: Number.parseInt(full.substring(2, 4), 16),
      b: Number.parseInt(full.substring(4, 6), 16),
    };
  },

  rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  parseColorString(color: string): { r: number; g: number; b: number; a: number } | null {
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      let r: number;
      let g: number;
      let b: number;
      let a = 255;
      if (hex.length === 3 || hex.length === 4) {
        r = Number.parseInt(hex[0] + hex[0], 16);
        g = Number.parseInt(hex[1] + hex[1], 16);
        b = Number.parseInt(hex[2] + hex[2], 16);
        if (hex.length === 4) a = Number.parseInt(hex[3] + hex[3], 16);
      } else if (hex.length === 6 || hex.length === 8) {
        r = Number.parseInt(hex.substring(0, 2), 16);
        g = Number.parseInt(hex.substring(2, 4), 16);
        b = Number.parseInt(hex.substring(4, 6), 16);
        if (hex.length === 8) a = Number.parseInt(hex.substring(6, 8), 16);
      } else {
        return null;
      }
      return { r, g, b, a };
    }

    const rgbaMatch = color.match(
      /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)/,
    );
    if (rgbaMatch) {
      return {
        r: Number.parseInt(rgbaMatch[1]),
        g: Number.parseInt(rgbaMatch[2]),
        b: Number.parseInt(rgbaMatch[3]),
        a: rgbaMatch[4] !== undefined ? Math.round(Number.parseFloat(rgbaMatch[4]) * 255) : 255,
      };
    }

    const hslaMatch = color.match(
      /hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*([\d.]+))?\s*\)/,
    );
    if (hslaMatch) {
      const h = Number.parseInt(hslaMatch[1]) / 360;
      const s = Number.parseInt(hslaMatch[2]) / 100;
      const l = Number.parseInt(hslaMatch[3]) / 100;
      const a = hslaMatch[4] !== undefined ? Number.parseFloat(hslaMatch[4]) : 1;

      let r: number;
      let g: number;
      let b: number;
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
        a: Math.round(a * 255),
      };
    }

    return null;
  },

  withOpacity(color: string, opacity: number): string {
    const c = Utils.parseColorString(color);
    if (!c) return color;
    const a = Math.max(0, Math.min(1, opacity));
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  },

  lighten(color: string, amount: number): string {
    const c = Utils.parseColorString(color);
    if (!c) return color;
    const t = Math.max(0, Math.min(1, amount));
    const r = Math.round(c.r + (255 - c.r) * t);
    const g = Math.round(c.g + (255 - c.g) * t);
    const b = Math.round(c.b + (255 - c.b) * t);
    const a = c.a / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  darken(color: string, amount: number): string {
    const c = Utils.parseColorString(color);
    if (!c) return color;
    const t = Math.max(0, Math.min(1, amount));
    const r = Math.round(c.r * (1 - t));
    const g = Math.round(c.g * (1 - t));
    const b = Math.round(c.b * (1 - t));
    const a = c.a / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  mixColors(color1: string, color2: string, ratio = 0.5): string {
    const c1 = Utils.parseColorString(color1);
    const c2 = Utils.parseColorString(color2);
    if (!c1 || !c2) return ratio < 0.5 ? color1 : color2;
    const t = Math.max(0, Math.min(1, ratio));
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    const a = (c1.a + (c2.a - c1.a) * t) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  },

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  angleBetween(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  },

  pointOnCircle(
    cx: number,
    cy: number,
    radius: number,
    angleDeg: number,
  ): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  },

  pointOnLine(x1: number, y1: number, x2: number, y2: number, t: number): { x: number; y: number } {
    const p = Math.max(0, Math.min(1, t));
    return {
      x: x1 + (x2 - x1) * p,
      y: y1 + (y2 - y1) * p,
    };
  },

  createRect(
    x: ScaleType,
    y: ScaleType,
    width: ScaleType,
    height: ScaleType,
    color: ColorType,
    radius?: { [corner in RadiusCorner]?: ScaleType },
    opts?: { id?: string; zIndex?: number },
  ): MorphLayer {
    const layer = new MorphLayer(undefined, opts)
      .setPosition(x, y)
      .setSize(width, height, radius)
      .setColor(color);
    return layer;
  },

  createCircle(
    x: ScaleType,
    y: ScaleType,
    size: ScaleType,
    color: ColorType,
    opts?: { id?: string; zIndex?: number },
  ): MorphLayer {
    const layer = new MorphLayer(undefined, opts)
      .setPosition(x, y)
      .setSize(size, size, { all: size })
      .setColor(color);
    return layer;
  },

  createLine(
    x1: ScaleType,
    y1: ScaleType,
    x2: ScaleType,
    y2: ScaleType,
    color: ColorType,
    strokeWidth?: number,
    opts?: { id?: string; zIndex?: number },
  ): LineLayer {
    const layer = new LineLayer(undefined, opts)
      .setPosition(x1, y1, x2, y2)
      .setColor(color)
      .setStroke(strokeWidth || 1);
    return layer;
  },

  createText(
    x: ScaleType,
    y: ScaleType,
    text: string,
    font: { family: string; size: number; weight?: AnyWeight },
    color: ColorType,
    opts?: {
      id?: string;
      zIndex?: number;
      align?: AnyTextAlign;
      multiline?: { width: ScaleType; height: ScaleType; spacing?: number };
    },
  ): TextLayer {
    const layer = new TextLayer(undefined, {
      id: opts?.id,
      zIndex: opts?.zIndex,
    })
      .setPosition(x, y)
      .setText(text)
      .setFont({
        family: font.family,
        size: font.size,
        weight: font.weight ?? FontWeight.Regular,
      })
      .setColor(color)
      .setAlign(opts?.align || TextAlign.Left);
    if (opts?.multiline) {
      layer.setMultiline(opts.multiline.width, opts.multiline.height, opts.multiline.spacing);
    }
    return layer;
  },

  createImage(
    x: ScaleType,
    y: ScaleType,
    src: string,
    width: ScaleType,
    height: ScaleType,
    radius?: { [corner in RadiusCorner]?: ScaleType },
    opts?: { id?: string; zIndex?: number },
  ): ImageLayer {
    const layer = new ImageLayer(undefined, opts)
      .setPosition(x, y)
      .setSrc(src)
      .setSize(width, height, radius);
    return layer;
  },
};

interface options {
  color?: ColorType;
  lineWidth?: number;
}

interface gridOptions extends options {
  cellWith?: number;
  cellHeight?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface gridOptionsNormalized {
  cellWith: number;
  cellHeight: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: ColorType;
  lineWidth: number;
}

export { Utils };

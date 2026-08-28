import {
  type Signal,
  type SignalOptions,
  type ThreadGenerator,
  type TweenConfig,
  isSignal,
  unwrap,
} from "../core/Signal";
import type {
  BezierLayer,
  IBezierLayer,
  IImageLayer,
  ILineLayer,
  IMorphLayer,
  IPath2DLayer,
  IPolygonLayer,
  IQuadraticLayer,
  ITextLayer,
  ImageLayer,
  LineLayer,
  MorphLayer,
  Path2DLayer,
  PolygonLayer,
  QuadraticLayer,
  TextLayer,
} from "../structures/components";
import type { Gradient, Link, Pattern } from "../structures/helpers";
import type {
  Centring,
  ColorSpace,
  Export,
  FontWeight,
  GlobalCompositeOperation,
  GradientType,
  LineCap,
  LineJoin,
  LinkType,
  PatternType,
  TextAlign,
  TextBaseline,
  TextDirection,
} from "./enum";

// Utility type for signal-enabled values
export type Signalable<T> = T | Signal<T>;

// Re-export for convenience
export type { ThreadGenerator, SignalOptions, TweenConfig };
export { unwrap, isSignal };

// Core types with Signal support
export type ScaleType =
  | `link-w-${string}-${number}`
  | `link-h-${string}-${number}`
  | `link-x-${string}-${number}`
  | `link-y-${string}-${number}`
  | `${number}%`
  | `${number}px`
  | number
  | "vw"
  | "vh"
  | "vmin"
  | "vmax"
  | Link
  | Signal<number>;

export type StringColorType =
  | `rgba(${number}, ${number}, ${number}, ${number})`
  | `rgb(${number}, ${number}, ${number})`
  | `hsl(${number}, ${number}%, ${number}%)`
  | `hsla(${number}, ${number}%, ${number}%, ${number})`
  | `#${string}`
  | string
  | Signal<string>;

export type ColorType = Gradient | Pattern | StringColorType;

export type JSONLayer =
  | IMorphLayer
  | IImageLayer
  | ITextLayer
  | IBezierLayer
  | IQuadraticLayer
  | ILineLayer
  | IPath2DLayer
  | IPolygonLayer;

export type AnyLayer =
  | MorphLayer
  | ImageLayer
  | TextLayer
  | BezierLayer
  | QuadraticLayer
  | LineLayer
  | Path2DLayer
  | PolygonLayer;

export type AnyWeight = FontWeight | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export type AnyGradientType = GradientType | "linear" | "radial" | "conic";

export type AnyTextAlign = TextAlign | "left" | "right" | "center" | "start" | "end";

export type AnyTextBaseline =
  | TextBaseline
  | "top"
  | "hanging"
  | "middle"
  | "alphabetic"
  | "ideographic"
  | "bottom";

export type AnyTextDirection = TextDirection | "ltr" | "rtl" | "inherit";

export type AnyLineCap = LineCap | "butt" | "round" | "square";

export type AnyLineJoin = LineJoin | "bevel" | "round" | "miter";

export type AnyExport =
  | Export
  | "canvas"
  | "ctx"
  | "buffer"
  | "png"
  | "apng"
  | "jpg"
  | "webp"
  | "yaml"
  | "json";

export type AnyCentring =
  | Centring
  | "start"
  | "start-top"
  | "start-bottom"
  | "center"
  | "center-top"
  | "center-bottom"
  | "end"
  | "end-top"
  | "end-bottom"
  | "none";

export type AnyPatternType = PatternType | "repeat" | "repeat-x" | "repeat-y" | "no-repeat";

export type AnyLinkType = LinkType | "width" | "height" | "x" | "y";

export type AnyGlobalCompositeOperation =
  | GlobalCompositeOperation
  | "source-over"
  | "source-in"
  | "source-out"
  | "source-atop"
  | "destination-over"
  | "destination-in"
  | "destination-out"
  | "destination-atop"
  | "lighter"
  | "copy"
  | "xor"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type AnyColorSpace = ColorSpace | "rgb565" | "rgba4444" | "rgba444";

export type AnyFilter =
  | `sepia(${number}%)`
  | `saturate(${number}%)`
  | `opacity(${number}%)`
  | `invert(${number}%)`
  | `hue-rotate(${number}deg)`
  | `grayscale(${number}%)`
  | `drop-shadow(${number}px ${number}px ${number}px ${string})`
  | `contrast(${number}%)`
  | `brightness(${number}%)`
  | `blur(${number}px)`;

export type Point = {
  x: ScaleType;
  y: ScaleType;
};

export type PointNumber = {
  x: number;
  y: number;
};

export type Extensions = "png" | "jpeg" | "jpg" | "webp" | "yaml" | "json";

export interface Transform {
  rotate?: number;
  scale?: {
    x: number;
    y: number;
  };
  translate?: {
    x: number;
    y: number;
  };
  matrix?: DOMMatrix2DInit;
}

export type RadiusCorner = "leftTop" | "leftBottom" | "rightTop" | "rightBottom" | "all";

export type SubStringColor = {
  color: StringColorType;
  start: number;
  end: number;
};

export type StrokeOptions = {
  width: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
  dashOffset?: number;
  dash?: number[];
  miterLimit?: number;
};

export interface ILayoutProps {
  width?: ScaleType;
  height?: ScaleType;
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  padding?: number | number[];
  margin?: number | number[];
  gap?: number;
  position?: "absolute" | "relative";
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

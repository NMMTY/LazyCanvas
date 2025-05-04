import { Gradient, Link, Pattern } from "../structures/helpers";
import {
    MorphLayer,
    ImageLayer,
    TextLayer,
    BezierLayer,
    QuadraticLayer,
    LineLayer,
    ClearLayer,
    IMorphLayer,
    IBezierLayer,
    IClearLayer,
    IImageLayer,
    ITextLayer,
    IQuadraticLayer,
    ILineLayer,
} from "../structures/components";
import {
    FontWeight,
    GradientType,
    TextAlign,
    TextBaseline,
    TextDirection,
    LineCap,
    LineJoin,
    Export,
    Centring,
    PatternType,
    LinkType,
    GlobalCompositeOperation,
    ColorSpace,
} from "./enum";

export type ScaleType = `link-w-${string}-${number}` | `link-h-${string}-${number}` | `link-x-${string}-${number}` | `link-y-${string}-${number}` | `${number}%` | number | 'vw' | 'vh' | 'vmin' | 'vmax' | Link;

export type ColorType = string | Gradient | Pattern;

export type JSONLayer = IMorphLayer | IImageLayer | ITextLayer | IBezierLayer | IQuadraticLayer | ILineLayer | IClearLayer;

export type AnyLayer = MorphLayer | ImageLayer | TextLayer | BezierLayer | QuadraticLayer | LineLayer | ClearLayer;

export type AnyWeight = FontWeight | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export type AnyGradientType = GradientType | 'linear' | 'radial' | 'conic';

export type AnyTextAlign = TextAlign | 'left' | 'right' | 'center' | 'start' | 'end';

export type AnyTextBaseline = TextBaseline | 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';

export type AnyTextDirection = TextDirection | 'ltr' | 'rtl' | 'inherit';

export type AnyLineCap = LineCap | 'butt' | 'round' | 'square';

export type AnyLineJoin = LineJoin | 'bevel' | 'round' | 'miter';

export type AnyExport = Export | 'canvas' | 'ctx' | 'buffer' | 'svg' | 'png' | 'jpeg' | 'jpg' | 'gif' | 'webp' | 'yaml' | 'json';

export type AnyCentring = Centring | 'start' | 'start-top' | 'start-bottom' | 'center' | 'center-top' | 'center-bottom' | 'end' | 'end-top' | 'end-bottom' | 'none';

export type AnyPatternType = PatternType | 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

export type AnyLinkType = LinkType | 'width' | 'height' | 'x' | 'y';

export type AnyGlobalCompositeOperation = GlobalCompositeOperation | 'source-over' | 'source-in' | 'source-out' | 'source-atop' | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop' | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type AnyColorSpace = ColorSpace | 'rgb565' | 'rgba4444' | 'rgba444';

export type AnyFilter = `sepia(${number}%)` | `saturate(${number}%)` | `opacity(${number}%)` | `invert(${number}%)` | `hue-rotate(${number}deg)` | `grayscale(${number}%)` | `drop-shadow(${number}px ${number}px ${number}px ${string})` | `contrast(${number}%)` | `brightness(${number}%)` | `blur(${number}px)`;

export type Point = {
    x: ScaleType;
    y: ScaleType;
}

export type PointNumber = {
    x: number;
    y: number;
};

export type Extensions = 'svg' | 'png' | 'jpeg' | 'jpg' | 'gif' | 'webp' | 'yaml' | 'json';

export interface Transform {
    rotate: number;
    scale: {
        x: number;
        y: number;
    };
    translate: {
        x: number;
        y: number;
    };
    matrix: DOMMatrix2DInit;
}
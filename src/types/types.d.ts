import { Gradient } from "../structures/helpers/Gradient";
import { Pattern } from "../structures/helpers/Pattern";
import { MorphLayer } from "../structures/components/MorphLayer";
import { ImageLayer } from "../structures/components/ImageLayer";
import { TextLayer } from "../structures/components/TextLayer";
import { BezierLayer } from "../structures/components/BezierLayer";
import { QuadraticLayer } from "../structures/components/QuadraticLayer";
import { LineLayer } from "../structures/components/LineLayer";
import { Group } from "../structures/components/Group";
import { ClearLayer } from "../structures/components/ClearLayer";
import { Link } from "../structures/helpers/Link";
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
    SaveFormat,
    LinkType,
    GlobalCompositeOperation,
    ColorSpace
} from "./enum";

export type ScaleType = string | number | 'vw' | 'vh' | 'vmin' | 'vmax' | Link;

export type ColorType = string | Gradient | Pattern;

export type AnyLayer = MorphLayer | ImageLayer | TextLayer | BezierLayer | QuadraticLayer | LineLayer | ClearLayer | Group;

export type AnyWeight = FontWeight | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export type AnyGradientType = GradientType | 'linear' | 'radial' | 'conic';

export type AnyTextAlign = TextAlign | 'left' | 'right' | 'center' | 'start' | 'end';

export type AnyTextBaseline = TextBaseline | 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';

export type AnyTextDirection = TextDirection | 'ltr' | 'rtl' | 'inherit';

export type AnyLineCap = LineCap | 'butt' | 'round' | 'square';

export type AnyLineJoin = LineJoin | 'bevel' | 'round' | 'miter';

export type AnyExport = Export | 'buffer' | 'svg' | 'ctx';

export type AnyCentring = Centring | 'start' | 'start-top' | 'start-bottom' | 'center' | 'center-top' | 'center-bottom' | 'end' | 'end-top' | 'end-bottom' | 'none';

export type AnyPatternType = PatternType | 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

export type AnySaveFormat = SaveFormat | 'png' | 'jpeg' | 'jpg' | 'svg' | 'gif' | 'webp';

export type AnyLinkType = LinkType | 'width' | 'height' | 'x' | 'y';

export type AnyGlobalCompositeOperation = GlobalCompositeOperation | 'source-over' | 'source-in' | 'source-out' | 'source-atop' | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop' | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type AnyColorSpace = ColorSpace | 'rgb565' | 'rgba4444' | 'rgba444';

export type Point = {
    x: ScaleType;
    y: ScaleType;
}

export type PointNumber = {
    x: number;
    y: number;
};
import { Gradient } from "../structures/helpers/Gradient";
import { Pattern } from "../structures/helpers/Pattern";
import { MorphLayer } from "../structures/components/MorphLayer";
import { ImageLayer } from "../structures/components/ImageLayer";
import { TextLayer } from "../structures/components/TextLayer";
import { BezierLayer } from "../structures/components/BezierLayer";
import { QuadraticLayer } from "../structures/components/QuadraticLayer";
import { Group } from "../structures/components/Group";

export type ScaleType = string | number | 'vw' | 'vh' | 'vmin' | 'vmax';

export type ColorType = string | Gradient | Pattern;

export type AnyLayer = MorphLayer | ImageLayer | TextLayer | BezierLayer | QuadraticLayer | Group;

export type Point = {
    x: ScaleType;
    y: ScaleType;
}

export type PointNumber = {
    x: number;
    y: number;
};
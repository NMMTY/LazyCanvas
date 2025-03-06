import { LazyCanvas } from "./structures/LazyCanvas";

import { ImageLayer } from "./structures/components/ImageLayer";
import { MorphLayer } from "./structures/components/MorphLayer";
import { TextLayer } from "./structures/components/TextLayer";
import { BezierLayer } from "./structures/components/BezierLayer";
import { QuadraticLayer } from "./structures/components/QuadraticLayer";
import { BaseLayer } from "./structures/components/BaseLayer";
import { Group } from "./structures/components/Group";

import {
    LayerType,
    LayerScaleType,
    LineCap,
    LineJoin,
    TextAlign,
    TextDirection,
    TextBaseline,
    FontWeight,
    Export,
    Centring,
    PatternType,
    SaveFormat,
    GradientType,
} from "./types/enum";

import type {
    AnyLayer,
    ScaleType,
    ColorType,
    IFont,
    IFonts,
    IGradient,
    IPattern,
    IImageLayer,
    IImageLayerProps,
    IMorphLayer,
    IMorphLayerProps,
    ITextLayer,
    ITextLayerProps,
    IBezierLayer,
    IBezierLayerProps,
    IQuadraticLayer,
    IQuadraticLayerProps,
    ILineLayer,
    ILineLayerProps,
    IBaseLayer,
    IBaseLayerProps,
    IGroup,
} from "./types";

import { Font } from "./structures/helpers/Font";
import { Gradient } from "./structures/helpers/Gradient";
import { Pattern } from "./structures/helpers/Pattern";

import {
    saveFile
} from "./utils/utils";

import { Filters } from "./helpers/filters";

export {
    LazyCanvas,
    ImageLayer,
    MorphLayer,
    TextLayer,
    BezierLayer,
    QuadraticLayer,
    BaseLayer,
    Group,
    Font,
    Gradient,
    Pattern,
    LayerScaleType,
    LayerType,
    FontWeight,
    GradientType,
    Export,
    LineCap,
    LineJoin,
    TextAlign,
    TextDirection,
    TextBaseline,
    SaveFormat,
    Centring,
    PatternType,
    saveFile,
    Filters,
    IFont,
    IFonts,
    IGradient,
    IPattern,
    IImageLayer,
    IImageLayerProps,
    IMorphLayer,
    IMorphLayerProps,
    ITextLayer,
    ITextLayerProps,
    IBaseLayer,
    IBaseLayerProps,
    IBezierLayer,
    IBezierLayerProps,
    IQuadraticLayer,
    IQuadraticLayerProps,
    IGroup,
    AnyLayer,
    ScaleType,
    ColorType,
}

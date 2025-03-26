import { LazyCanvas } from "./structures/LazyCanvas";

import { ImageLayer } from "./structures/components/ImageLayer";
import { MorphLayer } from "./structures/components/MorphLayer";
import { TextLayer } from "./structures/components/TextLayer";
import { BezierLayer } from "./structures/components/BezierLayer";
import { QuadraticLayer } from "./structures/components/QuadraticLayer";
import { LineLayer } from "./structures/components/LineLayer";
import { ClearLayer } from "./structures/components/ClearLayer";
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
    LinkType
} from "./types/enum";

import { Font } from "./structures/helpers/Font";
import { Gradient } from "./structures/helpers/Gradient";
import { Pattern } from "./structures/helpers/Pattern";
import { Link } from "./structures/helpers/Link";

import {
    saveFile
} from "./utils/utils";

import { Filters } from "./helpers/Filters";
import { FontsList } from "./helpers/FontsList";

export {
    LazyCanvas,
    ImageLayer,
    MorphLayer,
    TextLayer,
    BezierLayer,
    QuadraticLayer,
    LineLayer,
    ClearLayer,
    BaseLayer,
    Group,
    Font,
    Gradient,
    Pattern,
    Link,
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
    LinkType,
    saveFile,
    Filters,
    FontsList,
}

export type {
    AnyLayer,
    AnyCentring,
    AnyPatternType,
    AnyGradientType,
    AnyTextAlign,
    AnyTextDirection,
    AnyTextBaseline,
    AnyWeight,
    AnyExport,
    AnyLineCap,
    AnyLineJoin,
    AnySaveFormat,
    AnyLinkType,
    AnyGlobalCompositeOperation,
    AnyColorSpace,
    ScaleType,
    ColorType,
    Point,
    PointNumber,
    GradientPoint,
    GradientColorStop,
    Transform,
    ILazyCanvas,
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
    ILink,
    IFontsManager,
    ILayersManager,
    IRenderManager
} from "./types";

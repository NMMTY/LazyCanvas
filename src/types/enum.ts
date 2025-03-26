export enum LayerType {
    Base = 'base',
    Arc = 'arc',
    ArcTo = 'arcTo',
    BezierCurve = 'bezierCurve',
    Clip = 'clip',
    Image = 'image',
    Line = 'line',
    Path = 'path',
    QuadraticCurve = 'quadraticCurve',
    Morph = 'morph',
    Text = 'text',
    Group = 'group',
    Clear = 'clear',
}

export enum LayerScaleType {
    Pixel = 'px',
    Percent = '%',
    Canvas = 'canvas',
    None = 'none',
}


export enum GradientType {
    Linear = 'linear',
    Radial = 'radial',
    Conic = 'conic',
}

export enum FontWeight {
    Thin = 100,
    ExtraLight = 200,
    Light = 300,
    Regular = 400,
    Medium = 500,
    SemiBold = 600,
    Bold = 700,
    ExtraBold = 800,
    Black = 900,
    ExtraBlack = 950
}

export enum TextAlign {
    Left = 'left',
    Right = 'right',
    Center = 'center',
    Start = 'start',
    End = 'end'
}

export enum TextBaseline {
    Top = 'top',
    Hanging = 'hanging',
    Middle = 'middle',
    Alphabetic = 'alphabetic',
    Ideographic = 'ideographic',
    Bottom = 'bottom'
}

export enum TextDirection {
    LeftToRight = 'ltr',
    RightToLeft = 'rtl',
    Inherit = 'inherit'
}

export enum LineCap {
    Butt = 'butt',
    Round = 'round',
    Square = 'square'
}

export enum LineJoin {
    Bevel = 'bevel',
    Round = 'round',
    Miter = 'miter'
}

export enum Export {
    Buffer = 'buffer',
    SVG = 'svg',
    CTX = 'ctx',
}

export enum SaveFormat {
    PNG = 'png',
    JPEG = 'jpeg',
    JPG = 'jpg',
    SVG = 'svg',
    GIF = 'gif',
    WEBP = 'webp',
}

export enum Centring {
    Start = 'start',
    StartTop = 'start-top',
    StartBottom = 'start-bottom',
    Center = 'center',
    CenterTop = 'center-top',
    CenterBottom = 'center-bottom',
    End = 'end',
    EndTop = 'end-top',
    EndBottom = 'end-bottom',
    None = 'none'
}

export enum PatternType {
    Repeat = 'repeat',
    RepeatX = 'repeat-x',
    RepeatY = 'repeat-y',
    NoRepeat = 'no-repeat'
}

export enum LinkType {
    Width = 'width',
    Height = 'height',
    X = 'x',
    Y = 'y'
}

export enum GlobalCompositeOperation {
    SourceOver = 'source-over',
    SourceIn = 'source-in',
    SourceOut = 'source-out',
    SourceAtop = 'source-atop',
    DestinationOver = 'destination-over',
    DestinationIn = 'destination-in',
    DestinationOut = 'destination-out',
    DestinationAtop = 'destination-atop',
    Lighter = 'lighter',
    Copy = 'copy',
    Xor = 'xor',
    Multiply = 'multiply',
    Screen = 'screen',
    Overlay = 'overlay',
    Darken = 'darken',
    Lighten = 'lighten',
    ColorDodge = 'color-dodge',
    ColorBurn = 'color-burn',
    HardLight = 'hard-light',
    SoftLight = 'soft-light',
    Difference = 'difference',
    Exclusion = 'exclusion',
    Hue = 'hue',
    Saturation = 'saturation',
    Color = 'color',
    Luminosity = 'luminosity'
}

export enum ColorSpace {
    RGB565 = 'rgb565',
    RGBA4444 = 'rgba4444',
    RGBA444 = 'rgba444',
}
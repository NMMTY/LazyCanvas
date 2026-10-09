export enum LayerType {
  Base = "base",
  Arc = "arc",
  ArcTo = "arcTo",
  BezierCurve = "bezierCurve",
  Clip = "clip",
  Image = "image",
  Line = "line",
  Path = "path",
  QuadraticCurve = "quadraticCurve",
  Morph = "morph",
  Text = "text",
  Group = "group",
  Clear = "clear",
  Polygon = "polygon",
  Custom = "custom",
}

export enum LayerScaleType {
  Pixel = "px",
  Percent = "%",
  Canvas = "canvas",
  None = "none",
}

export enum GradientType {
  Linear = "linear",
  Radial = "radial",
  Conic = "conic",
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
  ExtraBlack = 950,
}

export enum TextAlign {
  Left = "left",
  Right = "right",
  Center = "center",
  Start = "start",
  End = "end",
}

export enum TextBaseline {
  Top = "top",
  Hanging = "hanging",
  Middle = "middle",
  Alphabetic = "alphabetic",
  Ideographic = "ideographic",
  Bottom = "bottom",
}

export enum TextDirection {
  LeftToRight = "ltr",
  RightToLeft = "rtl",
  /** Vertical writing, first character at the top. */
  TopToBottom = "ttb",
  /** Vertical writing, first character at the bottom. */
  BottomToTop = "btt",
  Inherit = "inherit",
}

/**
 * What gets stacked along the column in a vertical writing direction.
 */
export enum VerticalTextMode {
  /**
   * Whole words stay horizontal and upright; each word takes one slot down the
   * column. Suits alphabetic scripts.
   */
  Words = "words",
  /**
   * One character per slot, upright. This is how CJK text is set vertically —
   * the equivalent of CSS `text-orientation: upright`.
   */
  Ideographs = "ideographs",
}

/**
 * Where the next column goes when vertical text wraps.
 */
export enum ColumnDirection {
  /** Each new column to the left of the previous one (CSS `vertical-rl`). */
  RightToLeft = "rl",
  /** Each new column to the right of the previous one (CSS `vertical-lr`). */
  LeftToRight = "lr",
}

export enum LineCap {
  Butt = "butt",
  Round = "round",
  Square = "square",
}

export enum LineJoin {
  Bevel = "bevel",
  Round = "round",
  Miter = "miter",
}

export enum Export {
  CANVAS = "canvas",
  CTX = "ctx",
  BUFFER = "buffer",
  PNG = "png",
  APNG = "apng",
  JPG = "jpg",
  WEBP = "webp",
  YAML = "yaml",
  JSON = "json",
}

export enum Centring {
  Start = "start",
  StartTop = "start-top",
  StartBottom = "start-bottom",
  Center = "center",
  CenterTop = "center-top",
  CenterBottom = "center-bottom",
  End = "end",
  EndTop = "end-top",
  EndBottom = "end-bottom",
  None = "none",
}

export enum PatternType {
  Repeat = "repeat",
  RepeatX = "repeat-x",
  RepeatY = "repeat-y",
  NoRepeat = "no-repeat",
}

export enum LinkType {
  Width = "width",
  Height = "height",
  X = "x",
  Y = "y",
}

export enum GlobalCompositeOperation {
  SourceOver = "source-over",
  SourceIn = "source-in",
  SourceOut = "source-out",
  SourceAtop = "source-atop",
  DestinationOver = "destination-over",
  DestinationIn = "destination-in",
  DestinationOut = "destination-out",
  DestinationAtop = "destination-atop",
  Lighter = "lighter",
  Copy = "copy",
  Xor = "xor",
  Multiply = "multiply",
  Screen = "screen",
  Overlay = "overlay",
  Darken = "darken",
  Lighten = "lighten",
  ColorDodge = "color-dodge",
  ColorBurn = "color-burn",
  HardLight = "hard-light",
  SoftLight = "soft-light",
  Difference = "difference",
  Exclusion = "exclusion",
  Hue = "hue",
  Saturation = "saturation",
  Color = "color",
  Luminosity = "luminosity",
}

export enum ColorSpace {
  RGB565 = "rgb565",
  RGBA4444 = "rgba4444",
  RGBA444 = "rgba444",
}

export enum FillType {
  Solid = "solid",
  Gradient = "gradient",
  Pattern = "pattern",
}

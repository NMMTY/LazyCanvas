/**
 * Abstraction layer for canvas implementation.
 * Allows LazyCanvas to work with both @napi-rs/canvas (Node.js)
 * and native HTMLCanvasElement (Browser/React/Next.js).
 */

export interface ICanvasGradient {
  addColorStop(offset: number, color: string): void;
}

/**
 * Handle returned by `createPattern`. Its concrete shape is implementation
 * specific; it is only ever handed back to the same rendering context.
 */
export interface ICanvasPattern {
  setTransform?(transform?: DOMMatrix2DInit): void;
}

export interface IImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ICanvasRenderingContext2D {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  fill(): void;
  fill(path2D: any): void;
  stroke(): void;
  stroke(path2D: any): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: any, ...args: any[]): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  clip(): void;
  clip(path2D: any): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ICanvasGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): ICanvasGradient;
  createConicGradient(startAngle: number, x: number, y: number): ICanvasGradient;
  createPattern(image: any, repetition: string | null): ICanvasPattern | null;
  getImageData(x: number, y: number, w: number, h: number): IImageData;
  putImageData(imagedata: IImageData, dx: number, dy: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  roundRect(x: number, y: number, w: number, h: number, radii: number | number[]): void;
  isPointInPath(x: number, y: number): boolean;
  isPointInStroke(x: number, y: number): boolean;

  fillStyle: string | ICanvasGradient | ICanvasPattern;
  strokeStyle: string | ICanvasGradient | ICanvasPattern;
  globalAlpha: number;
  globalCompositeOperation: string;
  filter: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  lineDashOffset: number;
  setLineDash(segments: number[]): void;
  font: string;
  textAlign: string;
  textBaseline: string;
  direction: string;
  wordSpacing: string;
  letterSpacing: string;
  textRendering: string;
  fontKerning: string;
}

export interface ICanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): ICanvasRenderingContext2D;
}

export interface IFontsAdapter {
  registerFromPath(path: string, family: string): boolean;
  register(source: string, family: string): boolean;
  has(family: string): boolean;
  families: string[];
}

export type ImageSource = string | ArrayBuffer | Uint8Array | Buffer;

export interface ICanvasAdapter {
  createCanvas(width: number, height: number): ICanvas;
  fonts: IFontsAdapter;
  loadImage(src: ImageSource): Promise<any>;
  Path2D?: any;
}

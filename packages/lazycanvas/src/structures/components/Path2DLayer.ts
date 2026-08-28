import {
  type ColorType,
  type ICanvas,
  type ICanvasAdapter,
  type ICanvasRenderingContext2D,
  LayerType,
} from "../../types";
import type { StrokeOptions } from "../../types";
import {
  DrawUtils,
  LazyError,
  LazyLog,
  createPath2D,
  generateID,
  isColor,
  parseFillStyle,
  resolvePath2D,
  transform,
} from "../../utils";
import type { LayersManager } from "../managers";
import { BaseLayer, type IBaseLayer, type IBaseLayerMisc, type IBaseLayerProps } from "./BaseLayer";

export interface IPath2DLayer extends IBaseLayer {
  type: LayerType.Path;
  props: IPath2DLayerProps;
}

export interface IPath2DLayerProps extends IBaseLayerProps {
  path2D: any;
  color: ColorType;
  stroke?: StrokeOptions;
  loadFromSVG?: boolean;
  clipPath?: boolean;
}

export class Path2DLayer extends BaseLayer<IPath2DLayerProps> {
  id: string;
  type: LayerType.Path = LayerType.Path;
  zIndex: number;
  visible: boolean;
  props: IPath2DLayerProps;

  constructor(props?: IPath2DLayerProps, misc?: IBaseLayerMisc) {
    super(LayerType.Path, props || ({} as IPath2DLayerProps), misc);
    this.id = misc?.id || generateID(LayerType.Path);
    this.zIndex = misc?.zIndex || 1;
    this.visible = misc?.visible || true;
    this.props = props ? props : ({} as IPath2DLayerProps);
    this.props = this.validateProps(this.props);
  }

  setColor(color: ColorType): this {
    if (!color) throw new LazyError("The color of the layer must be provided");
    if (!isColor(color)) throw new LazyError("The color of the layer must be a valid color");
    this.props.color = color;
    return this;
  }

  setPath(path: any | string): this {
    // Strings are kept as-is and turned into a Path2D on first use, so the
    // layer can be built before an adapter (and therefore a Path2D) exists.
    this.props.path2D = path;
    return this;
  }

  /**
   * Returns the layer's `Path2D`, creating it on first use.
   *
   * @param {object} [adapter] - Adapter to take the Path2D implementation from.
   * @returns {any} The path instance, or undefined if no implementation exists.
   */
  private ensurePath(adapter?: { Path2D?: any }): any {
    const current = this.props.path2D;
    if (current !== undefined && current !== null && typeof current !== "string") return current;
    if (!resolvePath2D(adapter)) return undefined;
    this.props.path2D = createPath2D(typeof current === "string" ? current : undefined, adapter);
    return this.props.path2D;
  }

  loadFromSVG(path: true): this {
    this.props.loadFromSVG = path;
    return this;
  }

  setClipPath(clipPath: boolean): this {
    this.props.clipPath = clipPath;
    return this;
  }

  toSVGString(): string {
    const path = this.ensurePath();
    if (path && typeof path.toSVGString === "function") {
      return path.toSVGString();
    }
    return "";
  }

  addPath(path: any, transform?: DOMMatrix2DInit | undefined): this {
    const self = this.ensurePath();
    if (self && typeof self.addPath === "function") {
      self.addPath(path, transform);
    }
    return this;
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
  ): this {
    const path = this.ensurePath();
    if (path && typeof path.arc === "function") {
      path.arc(x, y, radius, startAngle, endAngle, anticlockwise);
    }
    return this;
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): this {
    const path = this.ensurePath();
    if (path && typeof path.arcTo === "function") {
      path.arcTo(x1, y1, x2, y2, radius);
    }
    return this;
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): this {
    const path = this.ensurePath();
    if (path && typeof path.bezierCurveTo === "function") {
      path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
    return this;
  }

  closePath(): this {
    const path = this.ensurePath();
    if (path && typeof path.closePath === "function") {
      path.closePath();
    }
    return this;
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
  ): this {
    const path = this.ensurePath();
    if (path && typeof path.ellipse === "function") {
      path.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
    }
    return this;
  }

  lineTo(x: number, y: number): this {
    const path = this.ensurePath();
    if (path && typeof path.lineTo === "function") {
      path.lineTo(x, y);
    }
    return this;
  }

  moveTo(x: number, y: number): this {
    const path = this.ensurePath();
    if (path && typeof path.moveTo === "function") {
      path.moveTo(x, y);
    }
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    const path = this.ensurePath();
    if (path && typeof path.quadraticCurveTo === "function") {
      path.quadraticCurveTo(cpx, cpy, x, y);
    }
    return this;
  }

  rect(x: number, y: number, width: number, height: number): this {
    const path = this.ensurePath();
    if (path && typeof path.rect === "function") {
      path.rect(x, y, width, height);
    }
    return this;
  }

  stroke(stroke?: any): this {
    const path = this.ensurePath();
    if (path && typeof path.stroke === "function") {
      path.stroke(stroke);
    }
    return this;
  }

  op(path: any, op: string): this {
    const self = this.ensurePath();
    if (self && typeof self.op === "function") {
      self.op(path, op);
    }
    return this;
  }

  getFillType(): any {
    const path = this.ensurePath();
    if (path && typeof path.getFillType === "function") {
      return path.getFillType();
    }
    return 0;
  }

  getFillTypeString(): string {
    const path = this.ensurePath();
    if (path && typeof path.getFillTypeString === "function") {
      return path.getFillTypeString();
    }
    return "winding";
  }

  setFillType(fillType: any): this {
    const path = this.ensurePath();
    if (path && typeof path.setFillType === "function") {
      path.setFillType(fillType);
    }
    return this;
  }

  simplify(): this {
    const path = this.ensurePath();
    if (path && typeof path.simplify === "function") {
      path.simplify();
    }
    return this;
  }

  asWinding(): this {
    const path = this.ensurePath();
    if (path && typeof path.asWinding === "function") {
      path.asWinding();
    }
    return this;
  }

  transform(matrix: DOMMatrix2DInit): this {
    const path = this.ensurePath();
    if (path && typeof path.transform === "function") {
      path.transform(matrix);
    }
    return this;
  }

  getBounds(): [left: number, top: number, right: number, bottom: number] {
    const path = this.ensurePath();
    if (path && typeof path.getBounds === "function") {
      return path.getBounds();
    }
    return [0, 0, 0, 0];
  }

  computeTightBounds(): [left: number, top: number, right: number, bottom: number] {
    const path = this.ensurePath();
    if (path && typeof path.computeTightBounds === "function") {
      return path.computeTightBounds();
    }
    return [0, 0, 0, 0];
  }

  trim(start: number, end: number, isComplement?: boolean): this {
    const path = this.ensurePath();
    if (path && typeof path.trim === "function") {
      path.trim(start, end, isComplement);
    }
    return this;
  }

  equals(other: Path2DLayer): boolean {
    const self = this.ensurePath();
    if (self && typeof self.equals === "function") {
      return self.equals(other.props.path2D);
    }
    return false;
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number): this {
    const path = this.ensurePath();
    if (path && typeof path.roundRect === "function") {
      path.roundRect(x, y, width, height, radius);
    }
    return this;
  }

  async draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ): Promise<void> {
    ctx.beginPath();
    ctx.save();

    // Node has no global Path2D, so the implementation comes from the adapter.
    const path = this.ensurePath(adapter);
    if (!path) {
      ctx.restore();
      throw new LazyError(
        `Path2DLayer "${this.id}" cannot be drawn: no Path2D implementation available from the canvas adapter`,
      );
    }

    if (debug)
      LazyLog.log("none", "Drawing Path2D Layer: ", {
        layerId: this.id,
        type: this.type,
      });

    if (this.props.transform) {
      transform(ctx, this.props.transform, { width: 0, height: 0, x: 0, y: 0, type: this.type });
    }

    DrawUtils.opacity(ctx, this.props.opacity);

    if (this.props.clipPath) {
      ctx.clip(path);
    } else if (this.props.color) {
      const fillStyle = await parseFillStyle(ctx, this.props.color, { debug, manager });

      if (this.props.globalComposite) {
        ctx.globalCompositeOperation = this.props.globalComposite;
      }

      DrawUtils.drawShadow(ctx, this.props.shadow);
      DrawUtils.filters(ctx, this.props.filter);
      DrawUtils.fillStyle(ctx, fillStyle, this.props.stroke);

      if (this.props.stroke) {
        ctx.stroke(path);
      } else {
        ctx.fill(path);
      }
    }

    ctx.restore();
    ctx.closePath();
  }

  toJSON(): IPath2DLayer {
    return {
      id: this.id,
      type: this.type,
      zIndex: this.zIndex,
      visible: this.visible,
      props: this.props,
    };
  }

  protected validateProps(data: IPath2DLayerProps): IPath2DLayerProps {
    return {
      ...super.validateProps(data),
      color: data.color || "#000000",
      // Materialised lazily by `ensurePath()` once a Path2D implementation is known.
      path2D: data.path2D ?? null,
      loadFromSVG: data.loadFromSVG || false,
      clipPath: data.clipPath || false,
    };
  }
}

import { ColorType, LayerType, ICanvas, ICanvasRenderingContext2D } from "../../types";
import {
  generateID,
  isColor,
  parseFillStyle,
  transform,
  LazyError,
  LazyLog,
  DrawUtils,
} from "../../utils";
import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { LayersManager } from "../managers";
import { StrokeOptions } from "../../types";

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
    if (typeof path === "string") {
      if (typeof Path2D !== "undefined") {
        this.props.path2D = new Path2D(path);
      }
    } else {
      this.props.path2D = path;
    }
    return this;
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
    if (this.props.path2D && typeof this.props.path2D.toSVGString === "function") {
      return this.props.path2D.toSVGString();
    }
    return "";
  }

  addPath(path: any, transform?: DOMMatrix2DInit | undefined): this {
    if (this.props.path2D && typeof this.props.path2D.addPath === "function") {
      this.props.path2D.addPath(path, transform);
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
    if (this.props.path2D && typeof this.props.path2D.arc === "function") {
      this.props.path2D.arc(x, y, radius, startAngle, endAngle, anticlockwise);
    }
    return this;
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): this {
    if (this.props.path2D && typeof this.props.path2D.arcTo === "function") {
      this.props.path2D.arcTo(x1, y1, x2, y2, radius);
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
    if (this.props.path2D && typeof this.props.path2D.bezierCurveTo === "function") {
      this.props.path2D.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
    return this;
  }

  closePath(): this {
    if (this.props.path2D && typeof this.props.path2D.closePath === "function") {
      this.props.path2D.closePath();
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
    if (this.props.path2D && typeof this.props.path2D.ellipse === "function") {
      this.props.path2D.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
    }
    return this;
  }

  lineTo(x: number, y: number): this {
    if (this.props.path2D && typeof this.props.path2D.lineTo === "function") {
      this.props.path2D.lineTo(x, y);
    }
    return this;
  }

  moveTo(x: number, y: number): this {
    if (this.props.path2D && typeof this.props.path2D.moveTo === "function") {
      this.props.path2D.moveTo(x, y);
    }
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    if (this.props.path2D && typeof this.props.path2D.quadraticCurveTo === "function") {
      this.props.path2D.quadraticCurveTo(cpx, cpy, x, y);
    }
    return this;
  }

  rect(x: number, y: number, width: number, height: number): this {
    if (this.props.path2D && typeof this.props.path2D.rect === "function") {
      this.props.path2D.rect(x, y, width, height);
    }
    return this;
  }

  stroke(stroke?: any): this {
    if (this.props.path2D && typeof this.props.path2D.stroke === "function") {
      this.props.path2D.stroke(stroke);
    }
    return this;
  }

  op(path: any, op: string): this {
    if (this.props.path2D && typeof this.props.path2D.op === "function") {
      this.props.path2D.op(path, op);
    }
    return this;
  }

  getFillType(): any {
    if (this.props.path2D && typeof this.props.path2D.getFillType === "function") {
      return this.props.path2D.getFillType();
    }
    return 0;
  }

  getFillTypeString(): string {
    if (this.props.path2D && typeof this.props.path2D.getFillTypeString === "function") {
      return this.props.path2D.getFillTypeString();
    }
    return "winding";
  }

  setFillType(fillType: any): this {
    if (this.props.path2D && typeof this.props.path2D.setFillType === "function") {
      this.props.path2D.setFillType(fillType);
    }
    return this;
  }

  simplify(): this {
    if (this.props.path2D && typeof this.props.path2D.simplify === "function") {
      this.props.path2D.simplify();
    }
    return this;
  }

  asWinding(): this {
    if (this.props.path2D && typeof this.props.path2D.asWinding === "function") {
      this.props.path2D.asWinding();
    }
    return this;
  }

  transform(matrix: DOMMatrix2DInit): this {
    if (this.props.path2D && typeof this.props.path2D.transform === "function") {
      this.props.path2D.transform(matrix);
    }
    return this;
  }

  getBounds(): [left: number, top: number, right: number, bottom: number] {
    if (this.props.path2D && typeof this.props.path2D.getBounds === "function") {
      return this.props.path2D.getBounds();
    }
    return [0, 0, 0, 0];
  }

  computeTightBounds(): [left: number, top: number, right: number, bottom: number] {
    if (this.props.path2D && typeof this.props.path2D.computeTightBounds === "function") {
      return this.props.path2D.computeTightBounds();
    }
    return [0, 0, 0, 0];
  }

  trim(start: number, end: number, isComplement?: boolean): this {
    if (this.props.path2D && typeof this.props.path2D.trim === "function") {
      this.props.path2D.trim(start, end, isComplement);
    }
    return this;
  }

  equals(path: Path2DLayer): boolean {
    if (this.props.path2D && typeof this.props.path2D.equals === "function") {
      return this.props.path2D.equals(path.props.path2D);
    }
    return false;
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number): this {
    if (this.props.path2D && typeof this.props.path2D.roundRect === "function") {
      this.props.path2D.roundRect(x, y, width, height, radius);
    }
    return this;
  }

  async draw(
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
  ): Promise<void> {
    ctx.beginPath();
    ctx.save();

    if (typeof this.props.path2D === "string") this.props.path2D = new Path2D(this.props.path2D)

    if (debug)
      LazyLog.log("none", `Drawing Path2D Layer: `, {
        layerId: this.id,
        type: this.type,
      });

    if (this.props.transform) {
      transform(ctx, this.props.transform, { width: 0, height: 0, x: 0, y: 0, type: this.type });
    }

    DrawUtils.opacity(ctx, this.props.opacity);

    if (this.props.clipPath) {
      ctx.clip(this.props.path2D);
    } else if (this.props.color) {
      let fillStyle = await parseFillStyle(ctx, this.props.color, { debug, manager });

      if (this.props.globalComposite) {
        ctx.globalCompositeOperation = this.props.globalComposite;
      }

      DrawUtils.drawShadow(ctx, this.props.shadow);
      DrawUtils.filters(ctx, this.props.filter);
      DrawUtils.fillStyle(ctx, fillStyle, this.props.stroke);

      if (this.props.stroke) {
        ctx.stroke(this.props.path2D);
      } else {
        ctx.fill(this.props.path2D);
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
    let path2D = data.path2D;
    if (!path2D) {
      if (typeof Path2D !== "undefined") {
        path2D = new Path2D();
      } else {
        path2D = null;
      }
    }
    return {
      ...super.validateProps(data),
      color: data.color || "#000000",
      path2D: path2D,
      loadFromSVG: data.loadFromSVG || false,
      clipPath: data.clipPath || false,
    };
  }
}

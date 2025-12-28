import { BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps } from "./BaseLayer";
import { ColorType, Point, ScaleType, Centring, LayerType, StrokeOptions } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import {
  getBoundingBoxBezier,
  isColor,
  parseFillStyle,
  parser,
  transform,
} from "../../utils/utils";
import { defaultArg, LazyError, LazyLog } from "../../utils/LazyUtil";
import { LayersManager } from "../managers";
import { DrawUtils } from "../../utils/DrawUtils";

/**
 * Interface representing a Bezier layer.
 */
export interface IBezierLayer extends IBaseLayer {
  /**
   * The type of the layer, which is a Bézier curve.
   */
  type: LayerType.BezierCurve;

  /**
   * The properties specific to the Bezier layer.
   */
  props: IBezierLayerProps;
}

/**
 * Interface representing the properties of a Bezier layer.
 */
export interface IBezierLayerProps extends IBaseLayerProps {
  position: IBaseLayerProps["position"] & {
    /**
     * The end x of the Bézier curve.
     */
    endX: ScaleType;

    /**
     * The end y of the Bézier curve.
     */
    endY: ScaleType;
  };

  /**
   * The control points of the Bézier curve.
   */
  controlPoints: Array<Point>;

  /**
   * The fill style (color or pattern) of the layer.
   */
  fillStyle: ColorType;

  /**
   * The stroke properties of the Bézier curve.
   */
  stroke: StrokeOptions;
}

/**
 * Class representing a Bezier layer, extending the BaseLayer class.
 */
export class BezierLayer extends BaseLayer<IBezierLayerProps> {
  /**
   * The properties of the Bezier layer.
   */
  props: IBezierLayerProps;

  /**
   * Constructs a new BezierLayer instance.
   * @param {IBezierLayerProps} [props] - The properties of the Bezier layer.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   */
  constructor(props?: IBezierLayerProps, misc?: IBaseLayerMisc) {
    super(LayerType.BezierCurve, props || ({} as IBezierLayerProps), misc);
    this.props = props ? props : ({} as IBezierLayerProps);
    this.props = this.validateProps(this.props);
  }

  /**
   * Sets the control points of the Bezier layer.
   * @param {Array<{ x: ScaleType, y: ScaleType }>} [controlPoints] - The control points of the Bezier layer.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the number of control points is not exactly 2.
   */
  setControlPoints(...controlPoints: { x: ScaleType; y: ScaleType }[]): this {
    if (controlPoints.length !== 2)
      throw new LazyError("The control points of the layer must be provided");
    this.props.controlPoints = controlPoints.flat();
    return this;
  }

  /**
   * Sets the position of the Bezier layer.
   * @param {ScaleType} [x] - The x-coordinate of the end point.
   * @param {ScaleType} [y] - The y-coordinate of the end point.
   * @param {ScaleType} [endX] - The x-coordinate of the end point.
   * @param {ScaleType} [endY] - The y-coordinate of the end point.
   * @returns {this} The current instance for chaining.
   */
  override setPosition(x: ScaleType, y: ScaleType, endX?: ScaleType, endY?: ScaleType): this {
    this.props.position = { x, y, endX: endX || 0, endY: endY || 0 };
    return this;
  }

  /**
   * Sets the color of the Bezier layer.
   * @param {ColorType} [color] - The color of the layer.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If the color is not provided or invalid.
   */
  setColor(color: ColorType): this {
    if (!color) throw new LazyError("The color of the layer must be provided");
    if (!isColor(color)) throw new LazyError("The color of the layer must be a valid color");
    this.props.fillStyle = color;
    return this;
  }

  /**
   * Sets the stroke properties of the Bezier layer.
   * @param {number} [width] - The width of the stroke.
   * @param {string} [cap] - The cap style of the stroke.
   * @param {string} [join] - The join style of the stroke.
   * @param {number[]} [dash] - The dash pattern of the stroke.
   * @param {number} [dashOffset] - The dash offset of the stroke.
   * @param {number} [miterLimit] - The miter limit of the stroke.
   * @returns {this} The current instance for chaining.
   */
  setStroke(
    width: number,
    cap?: CanvasLineCap,
    join?: CanvasLineJoin,
    dash?: number[],
    dashOffset?: number,
    miterLimit?: number,
  ): this {
    this.props.stroke = {
      width,
      cap: cap || "butt",
      join: join || "miter",
      dash: dash || [],
      dashOffset: dashOffset || 0,
      miterLimit: miterLimit || 10,
    };
    return this;
  }

  /**
   * Calculates the bounding box of the Bezier layer.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @returns {Object} The bounding box details including max, min, center, width, and height.
   */
  getBoundingBox(
    ctx: SKRSContext2D,
    canvas: Canvas | SvgCanvas,
    manager: LayersManager,
  ): { max: Point; min: Point; center: Point; width: number; height: number } {
    const parcer = parser(ctx, canvas, manager);

    const { xs, ys, cp1x, cp1y, cp2x, cp2y, xe, ye } = parcer.parseBatch({
      xs: { v: this.props.position.x },
      ys: { v: this.props.position.y, options: defaultArg.vl(true) },
      cp1x: { v: this.props.controlPoints[0].x },
      cp1y: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
      cp2x: { v: this.props.controlPoints[1].x },
      cp2y: { v: this.props.controlPoints[1].y, options: defaultArg.vl(true) },
      xe: { v: this.props.position.endX },
      ye: { v: this.props.position.endY, options: defaultArg.vl(true) },
    });

    const { max, min, center, width, height } = getBoundingBoxBezier([
      { x: xs, y: ys },
      { x: cp1x, y: cp1y },
      { x: cp2x, y: cp2y },
      { x: xe, y: ye },
    ]);
    return { max, min, center, width, height };
  }

  /**
   * Draws the Bezier layer on the canvas.
   * @param {SKRSContext2D} [ctx] - The canvas rendering context.
   * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
   * @param {LayersManager} [manager] - The layer's manager.
   * @param {boolean} [debug] - Whether to enable debug logging.
   */
  async draw(
    ctx: SKRSContext2D,
    canvas: Canvas | SvgCanvas,
    manager: LayersManager,
    debug: boolean,
  ): Promise<void> {
    const parcer = parser(ctx, canvas, manager);

    const { xs, ys, cp1x, cp1y, cp2x, cp2y, xe, ye } = parcer.parseBatch({
      xs: { v: this.props.position.x },
      ys: { v: this.props.position.y, options: defaultArg.vl(true) },
      cp1x: { v: this.props.controlPoints[0].x },
      cp1y: { v: this.props.controlPoints[0].y, options: defaultArg.vl(true) },
      cp2x: { v: this.props.controlPoints[1].x },
      cp2y: { v: this.props.controlPoints[1].y, options: defaultArg.vl(true) },
      xe: { v: this.props.position.endX },
      ye: { v: this.props.position.endY, options: defaultArg.vl(true) },
    });

    const { max, min, center, width, height } = getBoundingBoxBezier([
      { x: xs, y: ys },
      { x: cp1x, y: cp1y },
      { x: cp2x, y: cp2y },
      { x: xe, y: ye },
    ]);
    let fillStyle = await parseFillStyle(ctx, this.props.fillStyle, {
      debug,
      layer: { width, height, x: min.x, y: min.y, align: "none" },
      manager,
    });

    if (debug)
      LazyLog.log("none", `BezierLayer:`, {
        xs,
        ys,
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        xe,
        ye,
        max,
        min,
        center,
        width,
        height,
        fillStyle,
      });

    ctx.save();

    if (this.props.transform) {
      transform(ctx, this.props.transform, {
        x: center.x,
        y: center.y,
        width,
        height,
        type: this.type,
      });
    }
    DrawUtils.drawShadow(ctx, this.props.shadow);
    DrawUtils.opacity(ctx, this.props.opacity);
    DrawUtils.filters(ctx, this.props.filter);
    DrawUtils.fillStyle(ctx, fillStyle, this.props.stroke);

    ctx.beginPath();
    ctx.moveTo(xs, ys);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xe, ye);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
  }

  /**
   * Converts the Bezier layer to a JSON representation.
   * @returns {IBezierLayer} The JSON representation of the Bezier layer.
   */
  public toJSON(): IBezierLayer {
    let data = super.toJSON();
    let copy: any = { ...this.props };

    for (const key of ["x", "y", "endPoint.x", "endPoint.y", "fillStyle"]) {
      if (copy[key] && typeof copy[key] === "object" && "toJSON" in copy[key]) {
        copy[key] = copy[key].toJSON();
      }
    }

    if (copy.controlPoints) {
      copy.controlPoints = copy.controlPoints.map((point: { x: ScaleType; y: ScaleType }) => {
        if (point.x && typeof point.x === "object" && "toJSON" in point.x) {
          // @ts-ignore
          point.x = point.x.toJSON();
        }
        if (point.y && typeof point.y === "object" && "toJSON" in point.y) {
          // @ts-ignore
          point.y = point.y.toJSON();
        }
        return point;
      });
    }

    return { ...data, props: copy } as IBezierLayer;
  }

  /**
   * Validates the properties of the Bezier layer.
   * @param {IBezierLayerProps} [data] - The properties to validate.
   * @returns {IBezierLayerProps} The validated properties.
   */
  protected validateProps(data: IBezierLayerProps): IBezierLayerProps {
    return {
      ...super.validateProps(data),
      position: {
        x: data.position?.x || 0,
        y: data.position?.y || 0,
        endX: data.position?.endX || 0,
        endY: data.position?.endY || 0,
      },
      fillStyle: data.fillStyle || "#000000",
      centring: data.centring || Centring.None,
      controlPoints: data.controlPoints || [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      stroke: {
        width: data.stroke?.width || 1,
        cap: data.stroke?.cap || "butt",
        join: data.stroke?.join || "miter",
        dashOffset: data.stroke?.dashOffset || 0,
        dash: data.stroke?.dash || [],
        miterLimit: data.stroke?.miterLimit || 10,
      },
    };
  }
}

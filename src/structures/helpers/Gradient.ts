import { AnyCentring, AnyGradientType, Centring, FillType, GradientType, StringColorType, ScaleType } from "../../types";
import { SKRSContext2D } from "@napi-rs/canvas";
import { LazyLog, LazyError, defaultArg } from "../../utils/LazyUtil";
import { parser } from "../../utils/utils";
import { LayersManager } from "../managers/LayersManager";

/**
 * Interface representing a gradient.
 */
export interface IGradient {
    /**
     * The type of fill, which is always `Gradient` for this interface.
     */
    fillType: FillType;

    /**
     * The type of gradient (e.g., linear, radial, conic).
     */
    type: AnyGradientType;

    /**
     * The points defining the gradient.
     */
    points: Array<GradientPoint>;

    /**
     * The color stops for the gradient.
     */
    stops: Array<GradientColorStop>;

    /**
     * The angle of the gradient (optional, used for linear gradients).
     */
    angle?: number;
}

/**
 * Interface representing a color stop in a gradient.
 */
export interface GradientColorStop {
    /**
     * The color of the stop in hexadecimal format.
     */
    color: StringColorType;

    /**
     * The offset of the stop, ranging from 0 to 1.
     */
    offset: number;
}

/**
 * Interface representing a point in a gradient.
 */
export interface GradientPoint {
    /**
     * The x-coordinate of the point.
     */
    x: ScaleType;

    /**
     * The y-coordinate of the point.
     */
    y: ScaleType;

    /**
     * The radius of the point (optional, used for radial gradients).
     */
    r?: number;
}

/**
 * Class representing a gradient with properties and methods to manipulate it.
 */
export class Gradient implements IGradient {
    /**
     * The type of fill, which is always `Gradient`.
     */
    fillType: FillType = FillType.Gradient;

    /**
     * The type of gradient (e.g., linear, radial, conic).
     */
    type: AnyGradientType;

    /**
     * The points defining the gradient.
     */
    points: Array<GradientPoint>;

    /**
     * The color stops for the gradient.
     */
    stops: Array<GradientColorStop>;

    /**
     * The angle of the gradient (optional, used for linear gradients).
     */
    angle?: number;
    /**
     * Constructs a new Gradient instance.
     * @param opts {Object} - Optional properties for the gradient.
     * @param opts.props {IGradient} - The gradient properties.
     */
    constructor(opts?: { props?: IGradient }) {
        this.type = opts?.props?.type || GradientType.Linear;
        this.points = opts?.props?.points || [];
        this.stops = opts?.props?.stops || [];
        this.angle = opts?.props?.angle || 0;
    }

    /**
     * Sets the type of the gradient.
     * @param type {AnyGradientType} - The type of the gradient (e.g., linear, radial, conic).
     * @returns {this} The current instance for chaining.
     */
    setType(type: AnyGradientType): this {
        this.type = type;
        return this;
    }

    /**
     * Adds points to the gradient.
     * @param points {GradientPoint[]} - The points to add to the gradient.
     * @returns {this} The current instance for chaining.
     */
    addPoints(...points: GradientPoint[]): this {
        this.points.push(...points);
        return this;
    }

    /**
     * Sets the points of the gradient.
     * @param points {GradientPoint[]} - The points to set for the gradient.
     * @returns {this} The current instance for chaining.
     */
    setPoints(...points: GradientPoint[]): this {
        this.points = points;
        return this;
    }

    /**
     * Removes points from the gradient by their indexes.
     * @param indexes {number[]} - The indexes of the points to remove.
     * @returns {this} The current instance for chaining.
     */
    removePoints(...indexes: number[]): this {
        this.points = this.points.filter((_, index) => !indexes.includes(index));
        return this;
    }

    /**
     * Adds color stops to the gradient.
     * @param stops {GradientColorStop[]} - The color stops to add to the gradient.
     * @returns {this} The current instance for chaining.
     */
    addStops(...stops: GradientColorStop[]): this {
        this.stops.push(...stops);
        return this;
    }

    /**
     * Sets the color stops of the gradient.
     * @param stops {GradientColorStop[]} - The color stops to set for the gradient.
     * @returns {this} The current instance for chaining.
     */
    setStops(...stops: GradientColorStop[]): this {
        this.stops = stops;
        return this;
    }

    /**
     * Removes color stops from the gradient by their indexes.
     * @param indexes {number[]} - The indexes of the color stops to remove.
     * @returns {this} The current instance for chaining.
     */
    removeStops(...indexes: number[]): this {
        this.stops = this.stops.filter((_, index) => !indexes.includes(index));
        return this;
    }

    setAngle(angle: number): this {
        this.angle = angle;
        return this;
    }

    draw(ctx: SKRSContext2D, opts: { debug?: boolean, layer?: { width: number, height: number, x: number, y: number, align: AnyCentring }, manager?: LayersManager } = { debug: false }): CanvasGradient {
        let gradientData = this.toJSON();
        let gradient;

        if (opts.debug) LazyLog.log('none', `Gradient:`, gradientData);

        const parse = parser(ctx, ctx.canvas, opts.manager);

        const { x0, y0, x1, y1 } = parse.parseBatch({
            x0: { v: gradientData.points[0]?.x || 0 },
            y0: { v: gradientData.points[0]?.y || 0, options: defaultArg.vl(true) },
            x1: { v: gradientData.points[1]?.x || 0 },
            y1: { v: gradientData.points[1]?.y || 0, options: defaultArg.vl(true) }
        })

        if (opts.debug) LazyLog.log('none', `Gradient points:`, { x0, y0, x1, y1 });

        switch (gradientData.type) {
            case GradientType.Linear:
            case "linear":
                if (gradientData.type === "linear" && (gradientData.angle || gradientData.angle === 0) && opts.layer) {
                    const { width, height, x, y, align } = opts.layer;

                    const cx = this.getPosition(x, width, align, 'x');
                    const cy = this.getPosition(y, height, align, 'y');

                    const [p1, p2] = this.getLinearGradientPoints(cx, cy, width, height, gradientData.angle);

                    gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                } else {
                    gradient = ctx.createLinearGradient(
                        x0,
                        y0,
                        x1 || x0,
                        y1 || y0
                    );
                }
                break;
            case GradientType.Radial:
            case "radial":
                gradient = ctx.createRadialGradient(
                    x0,
                    y0,
                    gradientData.points[0].r || 0,
                    x1 || x0,
                    y1 || y0,
                    gradientData.points[1].r || 0
                );
                break;
            case GradientType.Conic:
            case "conic":
                gradient = ctx.createConicGradient(
                    (gradientData.angle || 0) * (Math.PI / 180),
                    x0,
                    y0
                );
                break;
            default:
                if ((gradientData.angle || gradientData.angle === 0) && opts.layer) {
                    const { width, height, x, y, align } = opts.layer;

                    const cx = this.getPosition(x, width, align, 'x');
                    const cy = this.getPosition(y, height, align, 'y');

                    const [p1, p2] = this.getLinearGradientPoints(cx, cy, width, height, gradientData.angle);

                    gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                } else {
                    gradient = ctx.createLinearGradient(
                        x0,
                        y0,
                        x1 || x0,
                        y1 || y0
                    );
                }
                break;
        }
        for (let stop of gradientData.stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        return gradient;
    }

    /**
     * Converts the gradient to a JSON representation.
     * @returns {IGradient} The JSON representation of the gradient.
     */
    toJSON(): IGradient {
        return {
            fillType: this.fillType,
            type: this.type,
            points: this.points,
            stops: this.stops,
            angle: this.angle
        };
    }

    private getLinearGradientPoints(cx: number, cy: number, w: number, h: number, angleInDegrees: number) {
        const angle = angleInDegrees * (Math.PI / 180);
        const x1 = cx;
        const y1 = cy - h / 2;
        const x2 = cx;
        const y2 = cy + h / 2;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const x1r = cx + (x1 - cx) * cos - (y1 - cy) * sin;
        const y1r = cy + (x1 - cx) * sin + (y1 - cy) * cos;
        const x2r = cx + (x2 - cx) * cos - (y2 - cy) * sin;
        const y2r = cy + (x2 - cx) * sin + (y2 - cy) * cos;

        return [
            { x: x1r, y: y1r },
            { x: x2r, y: y2r }
        ];
    }

    private getPosition(pos: number, side: number, align: AnyCentring, type: 'x' | 'y' = 'x'): number {
        switch (align) {
            case Centring.StartTop:
            case "start-top":
                return type === 'x' ? pos + (side / 2) : pos + (side / 2);
            case Centring.Start:
            case "start":
                return type === 'x' ? pos + (side / 2) : pos;
            case Centring.StartBottom:
            case "start-bottom":
                return type === 'x' ? pos + (side / 2) : pos - (side / 2);
            case Centring.CenterTop:
            case "center-top":
                return type === 'x' ? pos : pos - (side / 2);
            case Centring.Center:
            case "center":
                return type === 'x' ? pos : pos;
            case Centring.CenterBottom:
            case "center-bottom":
                return type === 'x' ? pos: pos - (side / 2);
            case Centring.EndTop:
            case "end-top":
                return type === 'x' ? pos - (side / 2) : pos + (side / 2);
            case Centring.End:
            case "end":
                return type === 'x' ? pos - (side / 2) : pos;
            case Centring.EndBottom:
            case "end-bottom":
                return type === 'x' ? pos - (side / 2) : pos - (side / 2);
            case Centring.None:
            case "none":
                return type === 'x' ? pos + (side / 2) : pos + (side / 2);
            default:
                throw new LazyError(`Invalid centring type: ${align}`);
        }
    }
}
import { AnyGradientType, FillType, GradientType } from "../../types";
import { SKRSContext2D } from "@napi-rs/canvas";
import { parseHex } from "../../utils/utils";

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
}

/**
 * Interface representing a color stop in a gradient.
 */
export interface GradientColorStop {
    /**
     * The color of the stop in hexadecimal format.
     */
    color: string;

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
    x: number;

    /**
     * The y-coordinate of the point.
     */
    y: number;

    /**
     * The radius of the point (optional, used for radial gradients).
     */
    r?: number;

    /**
     * The starting angle of the point (optional, used for conic gradients).
     */
    startAngle?: number;
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
     * Constructs a new Gradient instance.
     * @param opts {Object} - Optional properties for the gradient.
     * @param opts.props {IGradient} - The gradient properties.
     */
    constructor(opts?: { props?: IGradient }) {
        this.type = opts?.props?.type || GradientType.Linear;
        this.points = opts?.props?.points || [];
        this.stops = opts?.props?.stops || [];
    }

    /**
     * Sets the type of the gradient.
     * @param type {AnyGradientType} - The type of the gradient (e.g., linear, radial, conic).
     * @returns {this} The current instance for chaining.
     */
    setType(type: AnyGradientType) {
        this.type = type;
        return this;
    }

    /**
     * Adds points to the gradient.
     * @param points {GradientPoint[]} - The points to add to the gradient.
     * @returns {this} The current instance for chaining.
     */
    addPoints(...points: GradientPoint[]) {
        this.points.push(...points);
        return this;
    }

    /**
     * Adds color stops to the gradient.
     * @param stops {GradientColorStop[]} - The color stops to add to the gradient.
     * @returns {this} The current instance for chaining.
     */
    addStops(...stops: GradientColorStop[]) {
        this.stops.push(...stops);
        return this;
    }

    /**
     * Draws the gradient on a canvas context.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @returns {CanvasGradient} The created gradient.
     */
    draw(ctx: SKRSContext2D) {
        let gradientData = this.toJSON();
        let gradient;
        switch (gradientData.type) {
            case GradientType.Linear:
            case "linear":
                gradient = ctx.createLinearGradient(
                    gradientData.points[0].x,
                    gradientData.points[0].y,
                    gradientData.points[1].x,
                    gradientData.points[1].y
                );
                break;
            case GradientType.Radial:
            case "radial":
                gradient = ctx.createRadialGradient(
                    gradientData.points[0].x,
                    gradientData.points[0].y,
                    gradientData.points[0].r || 0,
                    gradientData.points[1].x || gradientData.points[0].x,
                    gradientData.points[1].y || gradientData.points[0].y,
                    gradientData.points[1].r || 0
                );
                break;
            case GradientType.Conic:
            case "conic":
                gradient = ctx.createConicGradient(
                    gradientData.points[0].startAngle || 0,
                    gradientData.points[0].x,
                    gradientData.points[0].y
                );
                break;
            default:
                gradient = ctx.createLinearGradient(
                    gradientData.points[0].x,
                    gradientData.points[0].y,
                    gradientData.points[1].x,
                    gradientData.points[1].y
                );
                break;
        }
        for (let stop of gradientData.stops) {
            gradient.addColorStop(stop.offset, parseHex(stop.color));
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
        };
    }
}
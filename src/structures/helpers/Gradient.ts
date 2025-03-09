import { GradientType } from "../../types/enum";
import { IGradient, GradientPoint, GradientColorStop, AnyGradientType } from "../../types";
import { SKRSContext2D } from "@napi-rs/canvas";
import { parseHex } from "../../utils/utils";

export class Gradient implements IGradient {
    type: AnyGradientType;
    points: Array<GradientPoint>;
    stops: Array<GradientColorStop>;

    constructor() {
        this.type = GradientType.Linear;
        this.points = [];
        this.stops = [];
    }

    /**
     * Set the type of the gradient
     * @param type {AnyGradientType} - The `type` of the gradient. Can be `linear`, `radial`, or `conic`
     */
    setType(type: AnyGradientType) {
        this.type = type;
        return this;
    }

    /**
     * Add a point to the gradient
     * @param points {GradientPoint[]} - The `points` to add to the gradient. `{ x: number, y: number }`
     */
    addPoints(...points: GradientPoint[]) {
        this.points.push(...points);
        return this;
    }

    /**
     * Add a stop to the gradient
     * @param stops {GradientColorStop[]} - The `stops` to add to the gradient. `{ color: string, position: number }`
     */
    addStops(...stops: GradientColorStop[]) {
        this.stops.push(...stops);
        return this;
    }

    draw(ctx: SKRSContext2D) {
        let gradientData = this.toJSON();
        let gradient;
        switch (gradientData.type) {
            case GradientType.Linear:
            case "linear":
                gradient = ctx.createLinearGradient(gradientData.points[0].x, gradientData.points[0].y, gradientData.points[1].x, gradientData.points[1].y);
                break;
            case GradientType.Radial:
            case "radial":
                gradient = ctx.createRadialGradient(gradientData.points[0].x, gradientData.points[0].y, (gradientData.points[0].r || 0), (gradientData.points[1].x || gradientData.points[0].x), (gradientData.points[1].y || gradientData.points[0].y), (gradientData.points[1].r || 0));
                break;
            case GradientType.Conic:
            case "conic":
                gradient = ctx.createConicGradient((gradientData.points[0].startAngle || 0), gradientData.points[0].x, gradientData.points[0].y);
                break;
            default:
                gradient = ctx.createLinearGradient(gradientData.points[0].x, gradientData.points[0].y, gradientData.points[1].x, gradientData.points[1].y);
                break;
        }
        for (let stop of gradientData.stops) {
            gradient.addColorStop(stop.offset, parseHex(stop.color));
        }
        return gradient;
    }

    /**
     * @returns {IGradient}
     */
    toJSON(): IGradient {
        return {
            type: this.type,
            points: this.points,
            stops: this.stops,
        };
    }
}

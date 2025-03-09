import { AnyGradientType } from "../";

export interface IGradient {
    type: AnyGradientType;
    points: Array<GradientPoint>;
    stops: Array<GradientColorStop>;
}

export interface GradientColorStop {
    color: string;
    offset: number;
}

export interface GradientPoint {
    x: number;
    y: number;
    r?: number;
    startAngle?: number;
}

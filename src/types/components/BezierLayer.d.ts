import { IBaseLayer, IBaseLayerProps } from "./BaseLayer";
import { Point } from "../";

export interface IBezierLayer extends IBaseLayer {
    props: IBezierLayerProps;
}

export interface IBezierLayerProps extends IBaseLayerProps {
    controlPoints: Array<Point>;
    endPoint: Point;
}
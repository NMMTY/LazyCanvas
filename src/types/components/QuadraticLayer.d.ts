import { IBaseLayer, IBaseLayerProps } from "./BaseLayer";
import { Point } from "../";

export interface IQuadraticLayer extends IBaseLayer {
    props: IQuadraticLayerProps;
}

export interface IQuadraticLayerProps extends IBaseLayerProps {
    controlPoint: Point;
    endPoint: Point;
}
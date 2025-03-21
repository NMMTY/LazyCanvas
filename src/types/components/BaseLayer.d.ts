import { ColorType, ScaleType, AnyCentring, AnyGlobalCompositeOperation } from "../";
import { LayerType } from "../enum";

export interface IBaseLayer {
    id: string;
    type: LayerType;
    zIndex: number;
    visible: boolean;
    props: IBaseLayerProps;
}

export interface IBaseLayerProps {
    x: ScaleType;
    y: ScaleType;
    centring: AnyCentring;
    filter: string;
    opacity: number;
    filled: boolean;
    fillStyle: ColorType;
    stroke: {
        width: number;
        cap: CanvasLineCap;
        join: CanvasLineJoin;
        dashOffset: number;
        dash: number[];
        miterLimit: number;
    };
    shadow: {
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    transform: Transform;
    globalComposite: AnyGlobalCompositeOperation;
}

export interface Transform {
    rotate: number;
    scale: {
        x: number;
        y: number;
    };
    translate: {
        x: number;
        y: number;
    };
    matrix: DOMMatrix2DInit;
}

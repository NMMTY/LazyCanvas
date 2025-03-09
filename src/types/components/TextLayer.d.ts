import { AnyWeight, ScaleType, AnyTextAlign, AnyTextBaseline, AnyTextDirection } from "../";
import { IBaseLayer, IBaseLayerProps } from "./BaseLayer";

export interface ITextLayer extends IBaseLayer {
    props: ITextLayerProps;
}

export interface ITextLayerProps extends IBaseLayerProps {
    text: string;
    font: {
        family: string;
        size: number;
        weight: AnyWeight;
    };
    multiline: {
        enabled: boolean;
        width: ScaleType;
        height: ScaleType;
        spacing?: number;
    };
    align: AnyTextAlign;
    baseline: AnyTextBaseline;
    direction: AnyTextDirection;
}

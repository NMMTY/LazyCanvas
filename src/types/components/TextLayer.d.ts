import { ColorType, ScaleType } from "../";
import { IBaseLayer, IBaseLayerProps } from "./BaseLayer";
import { FontWeight, TextAlign, TextBaseline, TextDirection } from "../enum";

export interface ITextLayer extends IBaseLayer {
    props: ITextLayerProps;
}

export interface ITextLayerProps extends IBaseLayerProps {
    text: string;
    font: {
        family: string;
        size: number;
        weight: FontWeight;
    };
    multiline: {
        enabled: boolean;
        width: ScaleType;
        height: ScaleType;
        spacing?: number;
    };
    align: TextAlign;
    baseline: TextBaseline;
    direction: TextDirection;
}

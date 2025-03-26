import { ScaleType } from "../types";
import { LayerType } from "../enum";

export interface IClearLayer {
    id: string;
    type: LayerType;
    zIndex: number;
    visible: boolean;
    props: IClearLayerProps;
}

export interface IClearLayerProps {
    x: ScaleType;
    y: ScaleType;
    size: {
        width: ScaleType;
        height: ScaleType;
    };
}
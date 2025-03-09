import { IBaseLayer, IBaseLayerProps } from "./BaseLayer";
import { ScaleType } from "../";

export interface IMorphLayer extends IBaseLayer {
    props: IMorphLayerProps;
}

export interface IMorphLayerProps extends IBaseLayerProps {
    size: {
        width: ScaleType;
        height: ScaleType;
        radius: ScaleType;
    };
}

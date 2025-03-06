import { IBaseLayer, IBaseLayerProps, ScaleType } from "../";

export interface ILineLayer extends IBaseLayer {
    props: ILineLayerProps;
}

export interface ILineLayerProps extends IBaseLayerProps {
    endPoint: {
        x: ScaleType,
        y: ScaleType
    }
}
import { ScaleType, LayerType } from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LayersManager } from "../managers/LayersManager";
import { parser } from "../../utils/utils";
import { defaultArg, LazyLog } from "../../utils/LazyUtil";
import { generateID } from "../../utils/utils";
import { IBaseLayerMisc } from "./BaseLayer";

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

export class ClearLayer implements IClearLayer {
    id: string;
    type: LayerType;
    zIndex: number;
    visible: boolean;
    props: IClearLayerProps;

    constructor(props?: IClearLayerProps, misc?: IBaseLayerMisc) {
        this.id = misc?.id || generateID(LayerType.Clear);
        this.type = LayerType.Clear;
        this.zIndex = misc?.zIndex || 1;
        this.visible = misc?.visible || true;
        this.props = props ? props : {
            x: 0,
            y: 0,
            size: {
                width: 0,
                height: 0
            }
        } as IClearLayerProps;
    }

    /**
     * @description Position of the layer in the 2D plane. You can use `numbers`, `percentages`, `px`, `vw`, `vh`, `vmin`, `vmax`.
     * @param x {ScaleType} - The `x` position of the layer
     * @param y {ScaleType} - The `y` position of the layer
     */
    setPosition(x: ScaleType, y: ScaleType) {
        this.props.x = x;
        this.props.y = y;
        return this;
    }

    /**
     * @description Sets the size of the layer.
     * @param width {ScaleType} - The `width` of the layer
     * @param height {ScaleType} - The `height` of the
     */
    setSize(width: ScaleType, height: ScaleType) {
        this.props.size = {
            width,
            height
        }
        return this;
    }

    /**
     * @description Sets the visibility of the layer.
     * @param visible {boolean} - The `visibility` of the layer
     */
    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    /**
     * @description Sets zIndex of the layer.
     * @param zIndex {number} - The `zIndex` of the layer
     */
    setZIndex(zIndex: number) {
        this.zIndex = zIndex;
        return this;
    }

    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        const parcer = parser(ctx, canvas, manager);

        const { x, y, w } = parcer.parseBatch({
            x: { v: this.props.x },
            y: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width },
        })
        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

        if (debug) LazyLog.log('none', `ClearLayer:`, { x, y, w, h });

        ctx.clearRect(x, y, w, h);
    }

    /**
     * @returns {IClearLayer}
     */
    toJSON(): IClearLayer {
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }
        return {
            id: this.id,
            type: this.type,
            zIndex: this.zIndex,
            visible: this.visible,
            props: copy,
        };
    }
}
import {ScaleType, LayerType, AnyCentring, AnyGlobalCompositeOperation} from "../../types";
import { Canvas, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { LayersManager } from "../managers/LayersManager";
import { parser, centring } from "../../utils/utils";
import { defaultArg, LazyLog } from "../../utils/LazyUtil";
import { generateID } from "../../utils/utils";
import { IBaseLayerMisc } from "./BaseLayer";

/**
 * Interface representing a Clear Layer.
 */
export interface IClearLayer {
    /**
     * The unique identifier of the layer.
     */
    id: string;

    /**
     * The type of the layer, which is `Clear`.
     */
    type: LayerType.Clear;

    /**
     * The z-index of the layer, determining its stacking order.
     */
    zIndex: number;

    /**
     * The visibility of the layer.
     */
    visible: boolean;

    /**
     * The properties of the Clear Layer.
     */
    props: IClearLayerProps;
}

/**
 * Interface representing the properties of a Clear Layer.
 */
export interface IClearLayerProps {
    /**
     * The x-coordinate of the layer.
     */
    x: ScaleType;

    /**
     * The y-coordinate of the layer.
     */
    y: ScaleType;

    /**
     * The size of the layer, including width and height.
     */
    size: {
        /**
         * The width of the layer.
         */
        width: ScaleType;

        /**
         * The height of the layer.
         */
        height: ScaleType;
    };

    /**
     * The centring type of the layer.
     */
    centring: AnyCentring;

    /**
     * Don't use, this is just for compatibility.
     */
    globalComposite: AnyGlobalCompositeOperation;
}

/**
 * Class representing a Clear Layer.
 */
export class ClearLayer implements IClearLayer {
    /**
     * The unique identifier of the layer.
     */
    id: string;

    /**
     * The type of the layer, which is `Clear`.
     */
    type: LayerType.Clear = LayerType.Clear;

    /**
     * The z-index of the layer, determining its stacking order.
     */
    zIndex: number;

    /**
     * The visibility of the layer.
     */
    visible: boolean;

    /**
     * The properties of the Clear Layer.
     */
    props: IClearLayerProps;

    /**
     * Constructs a new ClearLayer instance.
     * @param props {IClearLayerProps} - The properties of the Clear Layer.
     * @param misc {IBaseLayerMisc} - Miscellaneous options for the layer.
     */
    constructor(props?: IClearLayerProps, misc?: IBaseLayerMisc) {
        this.id = misc?.id || generateID(LayerType.Clear);
        this.type = LayerType.Clear;
        this.zIndex = misc?.zIndex || 1;
        this.visible = misc?.visible || true;
        this.props = props ? props : {} as IClearLayerProps;
        this.props = this.validateProps(this.props);
    }

    /**
     * Sets the position of the layer in the 2D plane.
     * @param x {ScaleType} - The x-coordinate of the layer.
     * @param y {ScaleType} - The y-coordinate of the layer.
     * @returns {this} The current instance for chaining.
     */
    setPosition(x: ScaleType, y: ScaleType): this {
        this.props.x = x;
        this.props.y = y;
        return this;
    }

    /**
     * Sets the size of the layer.
     * @param width {ScaleType} - The width of the layer.
     * @param height {ScaleType} - The height of the layer.
     * @returns {this} The current instance for chaining.
     */
    setSize(width: ScaleType, height: ScaleType): this {
        this.props.size = {
            width,
            height
        }
        return this;
    }

    /**
     * Sets the unique identifier of the layer.
     *
     * @param {string} id - The unique identifier.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string): this {
        this.id = id;
        return this;
    }

    /**
     * Sets the centring type of the layer.
     * @param centring {AnyCentring} - The centring type of the layer.
     * @returns {this} The current instance for chaining.
     */
    setCentring(centring: AnyCentring): this {
        this.props.centring = centring;
        return this;
    }

    /**
     * Sets the visibility of the layer.
     * @param visible {boolean} - The visibility state of the layer.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the layer.
     * @param zIndex {number} - The z-index value of the layer.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number): this {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Draws the Clear Layer on the canvas.
     * @param ctx {SKRSContext2D} - The canvas rendering context.
     * @param canvas {Canvas | SvgCanvas} - The canvas instance.
     * @param manager {LayersManager} - The layers manager.
     * @param debug {boolean} - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width },
        })
        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);

        if (debug) LazyLog.log('none', `ClearLayer:`, { x, y, w, h });

        ctx.clearRect(x, y, w, h);
    }

    /**
     * Converts the Clear Layer to a JSON representation.
     * @returns {IClearLayer} The JSON representation of the Clear Layer.
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

    protected validateProps(props: IClearLayerProps): IClearLayerProps {
        return {
            x: props.x || 0,
            y: props.y || 0,
            size: {
                width: props.size?.width || 0,
                height: props.size?.height || 0
            },
            centring: props.centring || 'none',
            globalComposite: props.globalComposite || 'source-over'
        }
    }
}
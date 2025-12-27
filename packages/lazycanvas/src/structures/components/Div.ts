import {AnyGlobalCompositeOperation, AnyLayer, LayerType} from "../../types";
import { generateID } from "../../utils/utils";
import {Canvas, SKRSContext2D, SvgCanvas} from "@napi-rs/canvas";
import {LayersManager} from "../managers";
import {LazyLog} from "../../utils/LazyUtil";

/**
 * Interface representing a group of layer's.
 */
export interface IDiv {
    /**
     * The unique identifier of the group.
     */
    id: string;

    /**
     * The type of the group, which is `Group`.
     */
    type: LayerType.Group;

    /**
     * The visibility of the group.
     */
    visible: boolean;

    /**
     * The z-index of the group, determining its stacking order.
     */
    zIndex: number;

    /**
     * The layer's contained within the group.
     */
    layers: Array<AnyLayer | Div>;

    /**
     *
     */
    props?: IDivProps;
}

export interface IDivProps {
    /**
     * Don't use, this is just for compatibility.
     */
    globalComposite: AnyGlobalCompositeOperation;
}

/**
 * Class representing a group of layer's.
 */
export class Div implements IDiv {
    /**
     * The unique identifier of the group.
     */
    id: string;

    /**
     * The type of the group, which is `Group`.
     */
    type: LayerType.Group = LayerType.Group;

    /**
     * The visibility of the group.
     */
    visible: boolean;

    /**
     * The z-index of the group, determining its stacking order.
     */
    zIndex: number;

    /**
     * The layer's contained within the group.
     */
    layers: Array<AnyLayer | Div>;

    props?: IDivProps;

    /**
     * Constructs a new Group instance.
     * @param {string} [opts.id] - The unique identifier of the group.
     * @param {boolean} [opts.visible] - The visibility of the group.
     * @param {number} [opts.zIndex] - The z-index of the group.
     */
    constructor(opts?: { id?: string, visible?: boolean, zIndex?: number }) {
        this.id = opts?.id || generateID(LayerType.Group);
        this.visible = opts?.visible || true;
        this.zIndex = opts?.zIndex || 1;
        this.layers = [];
        this.props = {} as IDivProps;
    }

    /**
     * Sets the ID of the group.
     * @param {string} [id] - The unique identifier of the group.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string): this {
        this.id = id;
        return this;
    }

    /**
     * Sets the visibility of the group.
     * @param {boolean} [visible] - The visibility state of the group.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the group.
     * @param {number} [zIndex] - The z-index value of the group.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number): this {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Adds components to the group.
     * @param {AnyLayer[] | Div[]} [components] - The components to add to the group.
     * @returns {this} The current instance for chaining.
     */
    add(...components: Array<AnyLayer | Div>): this {
        let layersArray = components.filter(l => l !== undefined);
        layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
        this.layers.push(...layersArray);
        return this;
    }

    /**
     * Removes a component from the group by its ID.
     * @param {string} [id] - The unique identifier of the component to remove.
     * @returns {this} The current instance for chaining.
     */
    remove(id: string): this {
        this.layers = this.layers.filter(c => c.id !== id);
        return this;
    }

    /**
     * Clears all components from the group.
     * @returns {this} The current instance for chaining.
     */
    clear(): this {
        this.layers = [];
        return this;
    }

    /**
     * Retrieves a component from the group by its ID.
     * @param {string} [id] - The unique identifier of the component to retrieve.
     * @returns {AnyLayer | Div | undefined} The component with the specified ID, or undefined if not found.
     */
    get(id: string): AnyLayer | Div | undefined {
        return this.layers.find(c => c.id === id);
    }

    /**
     * Retrieves all components from the group.
     * @returns {AnyLayer[] | Div[]} An array of all components in the group.
     */
    getAll(): Array<AnyLayer | Div> {
        return this.layers;
    }

    /**
     * Gets the number of components in the group.
     * @returns {number} The number of components in the group.
     */
    get length(): number {
        return this.layers.length;
    }

    /**
     * Update state for all child layers (for animation support)
     * @param {number} time - Current time in seconds
     */
    public updateState(time: number): void {
        for (const layer of this.layers) {
            if ('updateState' in layer && typeof layer.updateState === 'function') {
                layer.updateState(time);
            }
        }
    }

    public async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        for (const subLayer of this.layers) {
            if (debug) LazyLog.log('info', `Rendering ${subLayer.id}...\nData:`, subLayer.toJSON());
            if (subLayer.visible) {
                if (subLayer instanceof Div) {
                    await subLayer.draw(ctx, canvas, manager, debug);
                } else {
                    if ('globalComposite' in subLayer.props && subLayer.props.globalComposite) {
                        ctx.globalCompositeOperation = subLayer.props.globalComposite;
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                    }
                    await subLayer.draw(ctx, canvas, manager, debug);
                    ctx.shadowColor = 'transparent';
                }
            }
        }
    }

    /**
     * Converts the group to a JSON representation.
     * @returns {IDiv} The JSON representation of the group.
     */
    toJSON(): IDiv {
        return {
            id: this.id,
            type: this.type,
            visible: this.visible,
            zIndex: this.zIndex,
            // @ts-ignore
            layers: this.layers.map(c => c.toJSON())
        };
    }
}
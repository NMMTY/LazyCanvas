import {AnyGlobalCompositeOperation, AnyLayer, LayerType} from "../../types";
import { generateID } from "../../utils/utils";
import {Canvas, SKRSContext2D, SvgCanvas} from "@napi-rs/canvas";
import {LayersManager} from "../managers/LayersManager";
import {LazyLog} from "../../utils/LazyUtil";

/**
 * Interface representing a group of layers.
 */
export interface IGroup {
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
     * The layers contained within the group.
     */
    layers: Array<AnyLayer>;

    /**
     *
     */
    props?: IGroupProps;
}

export interface IGroupProps {
    /**
     * Don't use, this is just for compatibility.
     */
    globalComposite: AnyGlobalCompositeOperation;
}

/**
 * Class representing a group of layers.
 */
export class Group implements IGroup {
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
     * The layers contained within the group.
     */
    layers: Array<any>;

    props?: IGroupProps;

    /**
     * Constructs a new Group instance.
     * @param opts {Object} - Optional parameters for the group.
     * @param opts.id {string} - The unique identifier of the group.
     * @param opts.visible {boolean} - The visibility of the group.
     * @param opts.zIndex {number} - The z-index of the group.
     */
    constructor(opts?: { id?: string, visible?: boolean, zIndex?: number }) {
        this.id = opts?.id || generateID(LayerType.Group);
        this.visible = opts?.visible || true;
        this.zIndex = opts?.zIndex || 1;
        this.layers = [];
        this.props = {} as IGroupProps;
    }

    /**
     * Sets the ID of the group.
     * @param id {string} - The unique identifier of the group.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string): this {
        this.id = id;
        return this;
    }

    /**
     * Sets the visibility of the group.
     * @param visible {boolean} - The visibility state of the group.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the group.
     * @param zIndex {number} - The z-index value of the group.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number): this {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Adds components to the group.
     * @param components {AnyLayer[]} - The components to add to the group.
     * @returns {this} The current instance for chaining.
     */
    add(...components: AnyLayer[]): this {
        let layersArray = components.flat();
        layersArray = layersArray.filter(l => l !== undefined);
        layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
        this.layers.push(...layersArray);
        return this;
    }

    /**
     * Removes a component from the group by its ID.
     * @param id {string} - The unique identifier of the component to remove.
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
     * @param id {string} - The unique identifier of the component to retrieve.
     * @returns {AnyLayer | undefined} The component with the specified ID, or undefined if not found.
     */
    get(id: string): AnyLayer | undefined {
        return this.layers.find(c => c.id === id);
    }

    /**
     * Retrieves all components from the group.
     * @returns {AnyLayer[]} An array of all components in the group.
     */
    getAll(): AnyLayer[] {
        return this.layers;
    }

    /**
     * Gets the number of components in the group.
     * @returns {number} The number of components in the group.
     */
    get length(): number {
        return this.layers.length;
    }

    public async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean) {
        for (const subLayer of this.layers) {
            if (debug) LazyLog.log('info', `Rendering ${subLayer.id}...\nData:`, subLayer.toJSON());
            if (subLayer.visible) {
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

    /**
     * Converts the group to a JSON representation.
     * @returns {IGroup} The JSON representation of the group.
     */
    toJSON(): IGroup {
        return {
            id: this.id,
            type: this.type,
            visible: this.visible,
            zIndex: this.zIndex,
            layers: this.layers.map(c => c.toJSON())
        };
    }
}
import { AnyLayer, LayerType } from "../../types";
import { generateID } from "../../utils/utils";

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
    }

    /**
     * Sets the ID of the group.
     * @param id {string} - The unique identifier of the group.
     * @returns {this} The current instance for chaining.
     */
    setID(id: string) {
        this.id = id;
        return this;
    }

    /**
     * Sets the visibility of the group.
     * @param visible {boolean} - The visibility state of the group.
     * @returns {this} The current instance for chaining.
     */
    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    /**
     * Sets the z-index of the group.
     * @param zIndex {number} - The z-index value of the group.
     * @returns {this} The current instance for chaining.
     */
    setZIndex(zIndex: number) {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Adds components to the group.
     * @param components {AnyLayer[]} - The components to add to the group.
     * @returns {this} The current instance for chaining.
     */
    add(...components: AnyLayer[]) {
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
    remove(id: string) {
        this.layers = this.layers.filter(c => c.id !== id);
        return this;
    }

    /**
     * Clears all components from the group.
     * @returns {this} The current instance for chaining.
     */
    clear() {
        this.layers = [];
        return this;
    }

    /**
     * Retrieves a component from the group by its ID.
     * @param id {string} - The unique identifier of the component to retrieve.
     * @returns {AnyLayer | undefined} The component with the specified ID, or undefined if not found.
     */
    get(id: string) {
        return this.layers.find(c => c.id === id);
    }

    /**
     * Retrieves all components from the group.
     * @returns {AnyLayer[]} An array of all components in the group.
     */
    getAll() {
        return this.layers;
    }

    /**
     * Gets the number of components in the group.
     * @returns {number} The number of components in the group.
     */
    get length() {
        return this.layers.length;
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
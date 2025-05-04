import { AnyLayer, LayerType } from "../../types";
import { generateID } from "../../utils/utils";

export interface IGroup {
    id: string;
    type: LayerType;
    visible: boolean;
    zIndex: number;
    layers: Array<AnyLayer>;
}

export class Group implements IGroup {
    id: string;
    type: LayerType = LayerType.Group;
    visible: boolean;
    zIndex: number;
    layers: Array<any>;

    constructor(opts?: { id?: string, visible?: boolean, zIndex?: number }) {
        this.id = opts?.id || generateID(LayerType.Group);
        this.visible = opts?.visible || true;
        this.zIndex = opts?.zIndex || 1;
        this.layers = [];
    }

    /**
     * Set the ID of the group
     * @param id {string} - The `id` of the group
     */
    setID(id: string) {
        this.id = id;
        return this;
    }

    /**
     * Set the visibility of the group
     * @param visible {boolean} - The `visibility` of the group
     */
    setVisible(visible: boolean) {
        this.visible = visible;
        return this;
    }

    /**
     * Set the zIndex of the group
     * @param zIndex {number} - The `zIndex` of the group
     */
    setZIndex(zIndex: number) {
        this.zIndex = zIndex;
        return this;
    }

    /**
     * Add a component to the group
     * @param components {AnyLayer[]} - The `components` to add to the group
     */
    add(...components: AnyLayer[]) {
        let layersArray = components.flat();
        layersArray = layersArray.filter(l => l !== undefined);
        layersArray = layersArray.sort((a, b) => a.zIndex - b.zIndex);
        this.layers.push(...layersArray);
        return this;
    }

    /**
     * Remove a component from the group
     * @param id {any} - The `id` of the component to remove
     */
    remove(id: string) {
        this.layers = this.layers.filter(c => c.id !== id);
        return this;
    }

    /**
     * Clear all components from the group
     */
    clear() {
        this.layers = [];
        return this;
    }

    /**
     * Get a component from the group
     * @param id {string} - The `id` of the component to get
     */
    get(id: string) {
        return this.layers.find(c => c.id === id);
    }

    /**
     * Get all components from the group
     */
    getAll() {
        return this.layers;
    }

    /**
     * Get the length of the components
     */
    get length() {
        return this.layers.length;
    }

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
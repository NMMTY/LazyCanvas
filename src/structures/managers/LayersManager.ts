import { AnyLayer } from "../../types";
import { ILayersManager } from "../../types";
import { Group } from "../components/Group";
import { LazyError, LazyLog } from "../../utils/LazyUtil";

export class LayersManager implements ILayersManager {
    map: Map<string, AnyLayer | Group>;
    debug: boolean;

    constructor(debug: boolean = false) {
        this.map = new Map();
        this.debug = debug;
    }

    /**
     * Add a layer to the map
     * @param layers {AnyLayer[]} - The `layer` or `group` to add to the map
     */
    public add(...layers: AnyLayer[]) {
        if (this.debug) LazyLog.log('info', `Adding layers...\nlength: ${layers.length}`);
        let layersArray = layers.flat();
        layersArray = layersArray.filter(l => l !== undefined);
        for (const layer of layersArray) {
            if (this.debug) LazyLog.log('none', `Data:`, layer.toJSON());
            if (this.map.has(layer.id)) throw new LazyError("Layer already exists");
            this.map.set(layer.id, layer);
        }
        this.sort();
        return this;
    }

    /**
     * Remove a layer from the map
     * @param ids {string[]} - The `id` of the layer or group to remove
     */
    public remove(...ids: string[]) {
        for (const id of ids) {
            this.map.delete(id);
        }
        return this;
    }

    /**
     * ClearLayer all layers from the map
     */
    public clear() {
        this.map.clear();
        return this;
    }

    /**
     * Get a layer from the map
     * @param id {string} - The `id` of the layer or group to get
     * @param cross {boolean} - Whether to search in groups or not
     */
    public get(id: string, cross: boolean = false): AnyLayer | undefined {
        if (cross) return this.crossSearch(id);
        else return this.map.get(id);
    }

    /**
     * Check if a layer exists in the map
     * @param id {string} - The `id` of the layer or group to check
     */
    public has(id: string): boolean {
        return this.map.has(id);
    }

    /**
     * Get the size of the map
     */
    public size(): number {
        return this.map.size;
    }

    /**
     * Get the values of the map
     */
    public values(): IterableIterator<AnyLayer> {
        return this.map.values();
    }

    /**
     * Get the keys of the map
     */
    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    /**
     * Get the entries of the map
     */
    public entries(): IterableIterator<[string, AnyLayer]> {
        return this.map.entries();
    }

    /**
     * For each layer in the map
     * @param callbackfn {Function} - The `callback` function to execute
     */
    public forEach(callbackfn: (value: AnyLayer, key: string, map: Map<string, AnyLayer>) => void) {
        this.map.forEach(callbackfn);
        return this;
    }

    /**
     * Convert the map to a JSON object
     */
    public toJSON(): object {
        return Object.fromEntries(this.map);
    }

    /**
     * Convert a JSON object to the map
     * @param json {object} - The `json` object to convert
     */
    public fromJSON(json: object) {
        this.map = new Map(Object.entries(json));
        return this;
    }

    /**
     * Convert the map to an array
     */
    public toArray(): Array<AnyLayer> {
        return Array.from(this.map.values());
    }

    /**
     * Convert an array to the map
     * @param array {Array<AnyLayer>} - The `array` to convert
     */
    public fromArray(array: Array<AnyLayer>) {
        this.map = new Map(array.map(l => [l.id, l]));
        return this;
    }

    public sort() {
        this.fromArray(this.toArray().sort((a, b) => a.zIndex - b.zIndex));
    }

    private crossSearch(id: string): AnyLayer | undefined {
        for (const layer of Array.from(this.map.values())) {
            if (layer.id === id) return layer;
            if (layer instanceof Group) {
                const result = layer.components.find(l => l.id === id);
                if (result) return result;
            }
        }
        return undefined;
    }
}

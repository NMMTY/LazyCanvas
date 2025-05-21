import { AnyLayer } from "../../types";
import { Group } from "../components";
import { LazyError, LazyLog } from "../../utils/LazyUtil";

/**
 * Interface representing the LayersManager.
 */
export interface ILayersManager {
    /**
     * A map storing layers or groups with their IDs as keys.
     */
    map: Map<string, AnyLayer | Group>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;
}

/**
 * Class representing a manager for handling layers and groups.
 */
export class LayersManager implements ILayersManager {
    /**
     * A map storing layers or groups with their IDs as keys.
     */
    map: Map<string, AnyLayer | Group>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Constructs a new LayersManager instance.
     * @param opts {Object} - Optional settings for the LayersManager.
     * @param opts.debug {boolean} - Whether debugging is enabled.
     */
    constructor(opts?: { debug?: boolean }) {
        this.map = new Map();
        this.debug = opts?.debug || false;
    }

    /**
     * Adds layers or groups to the map.
     * @param layers {Array<AnyLayer | Group>} - The layers or groups to add to the map.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If a layer with the same ID already exists.
     */
    public add(...layers: Array<AnyLayer | Group>): this {
        if (this.debug) LazyLog.log('info', `Adding layers...\nlength: ${layers.length}`);
        let layersArray = layers.flat();
        layersArray = layersArray.filter(l => l !== undefined);
        for (const layer of layersArray) {
            if (this.debug) LazyLog.log('none', `Data:`, 'toJSON' in layer ? layer.toJSON() : layer);
            if (this.map.has(layer.id)) throw new LazyError("Layer already exists");
            this.map.set(layer.id, layer);
        }
        this.sort();
        return this;
    }

    /**
     * Removes layers or groups from the map by their IDs.
     * @param ids {string[]} - The IDs of the layers or groups to remove.
     * @returns {this} The current instance for chaining.
     */
    public remove(...ids: string[]): this {
        for (const id of ids) {
            this.map.delete(id);
        }
        return this;
    }

    /**
     * Clears all layers and groups from the map.
     * @returns {this} The current instance for chaining.
     */
    public clear(): this {
        this.map.clear();
        return this;
    }

    /**
     * Retrieves a layer or group from the map by its ID.
     * @param id {string} - The ID of the layer or group to retrieve.
     * @param cross {boolean} - Whether to search within groups for the ID.
     * @returns {AnyLayer | Group | undefined} The retrieved layer or group, or undefined if not found.
     */
    public get(id: string, cross: boolean = false): AnyLayer | Group | undefined {
        if (cross) return this.crossSearch(id);
        else return this.map.get(id);
    }

    /**
     * Checks if a layer or group exists in the map by its ID.
     * @param id {string} - The ID of the layer or group to check.
     * @returns {boolean} True if the layer or group exists, false otherwise.
     */
    public has(id: string): boolean {
        return this.map.has(id);
    }

    /**
     * Retrieves the number of layers and groups in the map.
     * @returns {number} The size of the map.
     */
    public size(): number {
        return this.map.size;
    }

    /**
     * Retrieves the values (layers and groups) from the map.
     * @returns {IterableIterator<AnyLayer | Group>} An iterator for the map values.
     */
    public values(): IterableIterator<AnyLayer | Group> {
        return this.map.values();
    }

    /**
     * Retrieves the keys (IDs) from the map.
     * @returns {IterableIterator<string>} An iterator for the map keys.
     */
    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    /**
     * Retrieves the entries (key-value pairs) from the map.
     * @returns {IterableIterator<[string, AnyLayer | Group]>} An iterator for the map entries.
     */
    public entries(): IterableIterator<[string, AnyLayer | Group]> {
        return this.map.entries();
    }

    /**
     * Executes a callback function for each layer or group in the map.
     * @param callbackfn {Function} - The callback function to execute.
     * @returns {this} The current instance for chaining.
     */
    public forEach(callbackfn: (value: AnyLayer | Group, key: string, map: Map<string, AnyLayer | Group>) => void): this {
        this.map.forEach(callbackfn);
        return this;
    }

    /**
     * Converts the map to a JSON object.
     * @returns {object} The JSON representation of the map.
     */
    public toJSON(): object {
        return Object.fromEntries(this.map);
    }

    /**
     * Populates the map from a JSON object.
     * @param json {object} - The JSON object to populate the map from.
     * @returns {this} The current instance for chaining.
     */
    public fromJSON(json: object): this {
        this.map = new Map(Object.entries(json));
        return this;
    }

    /**
     * Converts the map to an array of layers and groups.
     * @returns {Array<AnyLayer | Group>} An array of layers and groups.
     */
    public toArray(): Array<AnyLayer | Group> {
        return Array.from(this.map.values());
    }

    /**
     * Populates the map from an array of layers and groups.
     * @param array {Array<AnyLayer | Group>} - The array of layers and groups to populate the map from.
     * @returns {this} The current instance for chaining.
     */
    public fromArray(array: Array<AnyLayer | Group>): this {
        this.map = new Map(array.map(l => [l.id, l]));
        return this;
    }

    /**
     * Sorts the layers and groups in the map by their zIndex property.
     * @returns {void}
     */
    public sort(): void {
        this.fromArray(this.toArray().sort((a, b) => a.zIndex - b.zIndex));
    }

    /**
     * Searches for a layer or group by its ID, including within groups.
     * @param id {string} - The ID of the layer or group to search for.
     * @returns {AnyLayer | Group | undefined} The found layer or group, or undefined if not found.
     */
    private crossSearch(id: string): AnyLayer | Group | undefined {
        for (const layer of Array.from(this.map.values())) {
            if (layer.id === id) return layer;
            if (layer instanceof Group) {
                const result = layer.layers.find(l => l.id === id);
                if (result) return result;
            }
        }
        return undefined;
    }
}
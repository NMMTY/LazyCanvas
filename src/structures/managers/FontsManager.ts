import { Font, IFonts } from "../helpers";
import { LazyError, LazyLog } from "../../utils/LazyUtil";
import { Fonts } from "../../helpers/Fonts";
import { GlobalFonts } from "@napi-rs/canvas";

/**
 * Interface representing the FontsManager.
 */
export interface IFontsManager {
    /**
     * A map storing fonts with their family and weight as the key.
     */
    map: Map<string, Font>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;
}

/**
 * Class representing a manager for handling fonts.
 */
export class FontsManager implements IFontsManager {
    /**
     * A map storing fonts with their family and weight as the key.
     */
    map: Map<string, Font>;

    /**
     * Whether debugging is enabled.
     */
    debug: boolean;

    /**
     * Constructs a new FontsManager instance.
     * @param opts {Object} - Optional settings for the FontsManager.
     * @param opts.debug {boolean} - Whether debugging is enabled.
     */
    constructor(opts?: { debug?: boolean }) {
        this.map = new Map();
        this.debug = opts?.debug || false;

        this.loadFonts(Fonts);
    }

    /**
     * Loads fonts into the manager from a given font list.
     * @param fontList {IFonts} - The fonts to load into the manager.
     * @returns {this} The current instance for chaining.
     */
    loadFonts(fontList: IFonts): this {
        this.add(
            ...Object.entries(fontList).map(([fontFamily, fontWeights]) => {
                return Object.entries(fontWeights).map(([weight, base64]) => {
                    return new Font()
                        .setFamily(fontFamily)
                        .setWeight(Number(weight))
                        .setBase64(base64);
                });
            }).flat()
        );

        return this;
    }

    /**
     * Replace base fonts with custom fonts by special file.
     * Use this method before loading fonts by `FontManager`.
     * The file should be generated by the following instructions in MD file.
     * @see https://github.com/NMMTY/LazyCanvas/blob/main/scripts/FontsGenerate.md
     * @param fonts {Font[]} - The fonts to add to the manager.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If required font properties are missing or the font already exists.
     */
    public add(...fonts: Font[]): this {
        if (this.debug) LazyLog.log('info', `Adding fonts...\nlength: ${fonts.length}`);
        for (const font of fonts) {
            if (this.debug) LazyLog.log('none', `Data:`, font.toJSON());
            if (!font.family) throw new LazyError("Family must be provided");
            if (!font.weight) throw new LazyError("Weight must be provided");
            if (!font.path && !font.base64) throw new LazyError("Path or base64 must be provided");
            if (this.map.has(`${font.family}_${font.weight}`)) throw new LazyError("Font already exists");
            this.map.set(`${font.family}_${font.weight}`, font);
            if (font.path) GlobalFonts.registerFromPath(font.path, font.family);
            if (font.base64) GlobalFonts.register(font.base64, font.family);
        }
        return this;
    }

    /**
     * Removes fonts from the manager.
     * @param array {Array<{ family: string, weight: string }>} - The family and weight of the fonts to remove.
     * @returns {this} The current instance for chaining.
     */
    public remove(...array: Array<{ family: string, weight: string }> ): this {
        for (const font of array) {
            this.map.delete(`${font.family}_${font.weight}`);
        }
        return this;
    }

    /**
     * Clears all fonts from the manager.
     * @returns {this} The current instance for chaining.
     */
    public clear(): this {
        this.map.clear();
        return this;
    }

    /**
     * Retrieves a font or fonts from the manager.
     * @param family {string} - The family of the font to retrieve.
     * @param weight {string} - The weight of the font to retrieve (optional).
     * @returns {Font | Font[] | undefined} The retrieved font(s) or undefined if not found.
     */
    public get(family: string, weight?: string): Font | Font[] | undefined {
        if (weight) return this.map.get(`${family}_${weight}`);
        return Array.from(this.map.values()).filter(font => font.family === family);
    }

    /**
     * Checks if a font exists in the manager.
     * @param family {string} - The family of the font to check.
     * @param weight {string} - The weight of the font to check (optional).
     * @returns {boolean} True if the font exists, false otherwise.
     */
    public has(family: string, weight?: string): boolean {
        if (weight) return this.map.has(`${family}_${weight}`);
        return Array.from(this.map.values()).some(font => font.family === family);
    }

    /**
     * Retrieves the number of fonts in the manager.
     * @returns {number} The size of the font map.
     */
    public size(): number {
        return this.map.size;
    }

    /**
     * Retrieves the values (fonts) from the manager.
     * @returns {IterableIterator<Font>} An iterator for the font values.
     */
    public values(): IterableIterator<Font> {
        return this.map.values();
    }

    /**
     * Retrieves the keys (family and weight) from the manager.
     * @returns {IterableIterator<string>} An iterator for the font keys.
     */
    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    /**
     * Retrieves the entries (key-value pairs) from the manager.
     * @returns {IterableIterator<[string, Font]>} An iterator for the font entries.
     */
    public entries(): IterableIterator<[string, Font]> {
        return this.map.entries();
    }

    /**
     * Iterates over the fonts in the manager.
     * @param callbackfn {Function} - The function to execute on each font.
     * @param thisArg {any} - The `this` context to use (optional).
     * @returns {this} The current instance for chaining.
     */
    public forEach(callbackfn: (value: Font, key: string, map: Map<string, Font>) => void, thisArg?: any): this {
        this.map.forEach(callbackfn, thisArg);
        return this;
    }

    /**
     * Converts the font map to a JSON object.
     * @returns {object} The JSON representation of the font map.
     */
    public toJSON(): object {
        return Object.fromEntries(this.map);
    }

    /**
     * Populates the font map from a JSON object.
     * @param json {object} - The JSON object to populate the map from.
     * @returns {this} The current instance for chaining.
     */
    public fromJSON(json: object): this {
        this.map = new Map(Object.entries(json));
        return this;
    }

    /**
     * Converts the font map to an array.
     * @returns {Font[]} An array of fonts.
     */
    public toArray(): Font[] {
        return Array.from(this.map.values());
    }

    /**
     * Populates the font map from an array of fonts.
     * @param array {Font[]} - The array of fonts to populate the map from.
     * @returns {this} The current instance for chaining.
     */
    public fromArray(array: Font[]): this {
        for (const font of array) {
            this.map.set(`${font.family}_${font.weight}`, font);
        }
        return this;
    }
}
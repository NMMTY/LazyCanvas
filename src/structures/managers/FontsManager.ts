import { IFontsManager } from "../../types/managers/FontsManager";
import { Font } from "../helpers/Font";
import { LazyError } from "../../utils/LazyUtil";
import { Fonts } from "../Fonts";
import { IFonts } from "../../types/helpers/Font";
import { GlobalFonts } from "@napi-rs/canvas";

export class FontsManager implements IFontsManager {
    map: Map<string, Font>;

    constructor(fonts?: IFonts) {
        this.map = new Map();

        let fontList = fonts || Fonts;

        for (const fontFamily in fontList) {
            if (fontList.hasOwnProperty(fontFamily)) {
                for (const weight in fontList[fontFamily as keyof typeof fontList] as Record<number, Buffer>) {
                    if (fontList[fontFamily as keyof typeof fontList].hasOwnProperty(weight)) {
                        this.add(
                            new Font()
                                .setFamily(fontFamily)
                                .setWeight(Number(weight))
                                // @ts-ignore
                                .setBase64(fontList[fontFamily as keyof typeof fontList][weight])
                        );
                    }
                }
            }
        }
    }

    /**
     * Add a font to the map
     * @param fonts {Font[]} - The `font` to add to the map
     */
    public add(...fonts: Font[]): void {
        for (const font of fonts) {
            if (!font.family) throw new LazyError("Family must be provided");
            if (!font.weight) throw new LazyError("Weight must be provided");
            if (!font.path && !font.base64) throw new LazyError("Path or base64 must be provided");
            if (this.map.has(`${font.family}_${font.weight}`)) throw new LazyError("Font already exists");
            this.map.set(`${font.family}_${font.weight}`, font);
            if (font.path) GlobalFonts.registerFromPath(font.path, font.family);
            if (font.base64) GlobalFonts.register(font.base64, font.family);
        }
    }

    /**
     * Remove a font from the map
     * @param array {Array<{ family: string, weight: string }>} - The `family` and `weight` of the font to remove
     */
    public remove(...array: Array<{ family: string, weight: string }> ): void {
        for (const font of array) {
            this.map.delete(`${font.family}_${font.weight}`);
        }
    }

    /**
     * Clear all fonts from the map
     */
    public clear(): void {
        this.map.clear();
    }

    /**
     * Get a font from the map
     * @param family {string} - The `family` of the font to get
     * @param weight {string} - The `weight` of the font to get
     */
    public get(family: string, weight?: string): Font | Font[] | undefined {
        if (weight) return this.map.get(`${family}_${weight}`);
        return Array.from(this.map.values()).filter(font => font.family === family);
    }

    /**
     * Check if a font exists in the map
     * @param family {string} - The `family` of the font to check
     * @param weight {string} - The `weight` of the font to check
     */
    public has(family: string, weight?: string): boolean {
        if (weight) return this.map.has(`${family}_${weight}`);
        return Array.from(this.map.values()).some(font => font.family === family);
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
    public values(): IterableIterator<Font> {
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
    public entries(): IterableIterator<[string, Font]> {
        return this.map.entries();
    }

    /**
     * Iterate over the map
     * @param callbackfn {Function} - The function to execute on each font
     * @param thisArg {any} - The `this` context to use
     */
    public forEach(callbackfn: (value: Font, key: string, map: Map<string, Font>) => void, thisArg?: any): void {
        this.map.forEach(callbackfn, thisArg);
    }

    /**
     * Convert the map to a JSON object
     */
    public toJSON(): object {
        return Object.fromEntries(this.map);
    }

    /**
     * Convert the map from a JSON object
     * @param json {object} - The JSON object to convert
     */
    public fromJSON(json: object): void {
        this.map = new Map(Object.entries(json));
    }

    /**
     * Convert the map to an array
     */
    public toArray(): Font[] {
        return Array.from(this.map.values());
    }

    /**
     * Convert an array to the map
     * @param array {Font[]} - The `array` to convert
     */
    public fromArray(array: Font[]): void {
        for (const font of array) {
            this.map.set(`${font.family}_${font.weight}`, font);
        }
    }
}

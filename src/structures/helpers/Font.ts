import { FontWeight, AnyWeight } from "../../types";

/**
 * Interface representing a font.
 */
export interface IFont {
    /**
     * The font family.
     */
    family: string;

    /**
     * The weight of the font.
     */
    weight: AnyWeight;

    /**
     * The file path of the font (optional).
     */
    path?: string;

    /**
     * The base64 representation of the font (optional).
     */
    base64?: Buffer;
}

/**
 * Interface representing a collection of fonts.
 * Each font family maps to a record of font weights and their corresponding buffers.
 */
export interface IFonts {
    [family: string]: Record<number, Buffer>;
}

/**
 * Class representing a font with properties such as family, weight, path, and base64.
 */
export class Font implements IFont {
    /**
     * The font family.
     */
    family: string;

    /**
     * The weight of the font.
     */
    weight: AnyWeight;

    /**
     * The file path of the font (optional).
     */
    path?: string;

    /**
     * The base64 representation of the font (optional).
     */
    base64?: Buffer;

    /**
     * Constructs a new Font instance with default values.
     */
    constructor() {
        this.family = "Arial";
        this.weight = FontWeight.Regular;
    }

    /**
     * Sets the font family.
     * @param family {string} - The `family` of the font.
     * @returns {this} The current instance for chaining.
     * @throws {Error} If the family is not provided.
     */
    setFamily(family: string): this {
        if (!family) throw new Error("Family must be provided");
        this.family = family;
        return this;
    }

    /**
     * Sets the font weight.
     * @param weight {AnyWeight} - The `weight` of the font.
     * @returns {this} The current instance for chaining.
     * @throws {Error} If the weight is not provided.
     */
    setWeight(weight: AnyWeight): this {
        if (!weight) throw new Error("Weight must be provided");
        this.weight = weight;
        return this;
    }

    /**
     * Sets the file path of the font.
     * @param path {string} - The `path` of the font.
     * @returns {this} The current instance for chaining.
     * @throws {Error} If the path is not provided.
     */
    setPath(path: string): this {
        if (!path) throw new Error("Path must be provided");
        this.path = path;
        return this;
    }

    /**
     * Sets the base64 representation of the font.
     * @param base64 {Buffer} - The `base64` of the font.
     * @returns {this} The current instance for chaining.
     * @throws {Error} If the base64 is not provided.
     */
    setBase64(base64: Buffer): this {
        if (!base64) throw new Error("Base64 must be provided");
        this.base64 = base64;
        return this;
    }

    /**
     * Converts the Font instance to a JSON representation.
     * @returns {IFont} The JSON representation of the font.
     */
    toJSON(): IFont {
        return {
            family: this.family,
            weight: this.weight,
            path: this.path,
            base64: this.base64
        };
    }
}
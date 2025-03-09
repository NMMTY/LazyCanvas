import { FontWeight } from "../../types/enum";
import { AnyWeight } from "../../types";
import { IFont } from "../../types";

export class Font implements IFont {
    family: string;
    weight: AnyWeight;
    path?: string;
    base64?: Buffer;

    constructor() {
        this.family = "Arial";
        this.weight = FontWeight.Regular;
    }

    /**
     * Set the font family
     * @param family {string} - The `family` of the font
     */
    setFamily(family: string) {
        if (!family) throw new Error("Family must be provided");
        this.family = family;
        return this;
    }

    /**
     * Set the font weight
     * @param weight {AnyWeight} - The `weight` of the font
     */
    setWeight(weight: AnyWeight) {
        if (!weight) throw new Error("Weight must be provided");
        this.weight = weight;
        return this;
    }

    /**
     * Set the path of the font
     * @param path {string} - The `path` of the font
     */
    setPath(path: string) {
        if (!path) throw new Error("Path must be provided");
        this.path = path;
        return this;
    }

    /**
     * Set the base64 of the font
     * @param base64 {string} - The `base64` of the font
     */
    setBase64(base64: Buffer) {
        if (!base64) throw new Error("Base64 must be provided");
        this.base64 = base64;
        return this;
    }

    /**
     * @returns {IFont}
     */
    toJSON(): IFont {
        return {
            family: this.family,
            weight: this.weight,
            path: this.path,
            base64: this.base64
        }
    }
}

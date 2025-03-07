import { FontWeight } from "../enum";

export interface IFont {
    family: string;
    weight: FontWeight;
    path?: string;
    base64?: Buffer;
}

export interface IFonts {
    [family: string]: Record<number, Buffer>;
}

import { AnyWeight } from "../";

export interface IFont {
    family: string;
    weight: AnyWeight;
    path?: string;
    base64?: Buffer;
}

export interface IFonts {
    [family: string]: Record<number, Buffer>;
}

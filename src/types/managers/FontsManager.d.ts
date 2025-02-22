import { Font } from "../../structures/helpers/Font";

export interface IFontsManager {
    map: Map<string, Font>;
    debug: boolean;
}

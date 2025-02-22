import { AnyLayer } from "../";
import { Group } from "../../structures/components/Group";

export interface ILayersManager {
    map: Map<string, AnyLayer | Group>;
    debug: boolean;
}

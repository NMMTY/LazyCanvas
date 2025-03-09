import { AnyLayer } from "../";

export interface IGroup {
    id: string;
    visible: boolean;
    zIndex: number;
    components: Array<AnyLayer>;
}

import { AnyLinkType, ScaleType } from "../types";

export interface ILink {
    source: string;
    type: AnyLinkType;
    additionalSpacing: ScaleType;
}
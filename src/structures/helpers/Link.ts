import { AnyLinkType, ILink, ScaleType } from "../../types";
import { LinkType } from "../../types/enum";

export class Link {
    source: string;
    type: AnyLinkType;
    additionalSpacing: ScaleType;

    constructor(props?: ILink) {
        this.source = props?.source || '';
        this.type = props?.type || LinkType.Width;
        this.additionalSpacing = props?.additionalSpacing || 0;
    }

    /**
     * @description Sets the source of the link.
     * @param source {string} - The `id` of the layer to link.
     */
    setSource(source: string) {
        this.source = source;
        return this;
    }

    /**
     * @description Sets the type of the link.
     * @param type {AnyLinkType} - The `type` of the link.
     */

    setType(type: AnyLinkType) {
        this.type = type;
        return this;
    }

    /**
     * @description Sets the additional spacing of the link.
     * @param additionalSpacing {ScaleType} - The `additionalSpacing` of the link.
     */
    setSpacing(additionalSpacing: ScaleType) {
        this.additionalSpacing = additionalSpacing;
        return this;
    }
}
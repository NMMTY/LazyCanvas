import { AnyLinkType, ScaleType, LinkType } from "../../types";

export interface ILink {
    source: string;
    type: AnyLinkType;
    additionalSpacing: ScaleType;
}

export class Link {
    source: string;
    type: AnyLinkType;
    additionalSpacing: ScaleType;

    constructor(opts?: { props?: ILink }) {
        this.source = opts?.props?.source || '';
        this.type = opts?.props?.type || LinkType.Width;
        this.additionalSpacing = opts?.props?.additionalSpacing || 0;
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

    /**
     * @returns {ILink}
     */
    toJSON(): ILink {
        return {
            source: this.source,
            type: this.type,
            additionalSpacing: this.additionalSpacing
        }
    }
}
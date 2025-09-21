import { AnyLinkType, ScaleType, LinkType } from "../../types";

/**
 * Interface representing a link between layers.
 */
export interface ILink {
    /**
     * The source layers ID.
     */
    source: string;

    /**
     * The type of the link (e.g., width, height, etc.).
     */
    type: AnyLinkType;

    /**
     * The additional spacing applied to the link.
     */
    additionalSpacing: ScaleType;
}

/**
 * Class representing a link between layers with properties and methods to manipulate it.
 */
export class Link {
    /**
     * The source layers ID.
     */
    source: string;

    /**
     * The type of the link (e.g., width, height, etc.).
     */
    type: AnyLinkType;

    /**
     * The additional spacing applied to the link.
     */
    additionalSpacing: ScaleType;

    /**
     * Constructs a new Link instance.
     * @param {Object} [opts] - Optional properties for the link.
     * @param {ILink} [opts.props] - The link properties.
     */
    constructor(opts?: { props?: ILink }) {
        this.source = opts?.props?.source || '';
        this.type = opts?.props?.type || LinkType.Width;
        this.additionalSpacing = opts?.props?.additionalSpacing || 0;
    }

    /**
     * Sets the source of the link.
     * @param {string} [source] - The ID of the layer to link.
     * @returns {this} The current instance for chaining.
     */
    setSource(source: string): this {
        this.source = source;
        return this;
    }

    /**
     * Sets the type of the link.
     * @param {AnyLinkType} [type] - The type of the link.
     * @returns {this} The current instance for chaining.
     */
    setType(type: AnyLinkType): this {
        this.type = type;
        return this;
    }

    /**
     * Sets the additional spacing of the link.
     * @param {ScaleType} [additionalSpacing] - The additional spacing of the link.
     * @returns {this} The current instance for chaining.
     */
    setSpacing(additionalSpacing: ScaleType): this {
        this.additionalSpacing = additionalSpacing;
        return this;
    }

    /**
     * Converts the Link instance to a JSON representation.
     * @returns {ILink} The JSON representation of the link.
     */
    toJSON(): ILink {
        return {
            source: this.source,
            type: this.type,
            additionalSpacing: this.additionalSpacing
        };
    }
}
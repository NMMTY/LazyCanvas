import {BaseLayer, IBaseLayer, IBaseLayerMisc, IBaseLayerProps} from "./BaseLayer";
import {ColorType, LayerType, ScaleType} from "../../types";
import {defaultArg, LazyError, LazyLog} from "../../utils/LazyUtil";
import {centring, isColor, parseFillStyle, parser} from "../../utils/utils";
import {Canvas, SKRSContext2D, SvgCanvas} from "@napi-rs/canvas";
import {LayersManager} from "../managers";

export interface IPolygonLayer extends IBaseLayer {
    /**
     * The type of the layer, which is `Polygon`.
     */
    type: LayerType.Polygon

    /**
     * The properties specific to the Polygon Layer.
     */
    props: IPolygonLayerProps;
}

export interface IPolygonLayerProps extends IBaseLayerProps {
    /**
     * The size of the Polygon Layer, including width, height, and radius.
     */
    size: {
        /**
         * The width of the Polygon Layer.
         */
        width: ScaleType;

        /**
         * The height of the Polygon Layer.
         */
        height: ScaleType;

        /**
         * The radius of corners in the Polygon Layer.
         */
        radius: number;

        /**
         * The number of sides of the polygon.
         */
        count: number
    };

    /**
     * Whether the layer is filled.
     */
    filled: boolean;

    /**
     * The fill style (color or pattern) of the layer.
     */
    fillStyle: ColorType;

    /**
     * The stroke properties of the polygon.
     */
    stroke: {
        /**
         * The width of the stroke.
         */
        width: number;

        /**
         * The cap style of the stroke.
         */
        cap: CanvasLineCap;

        /**
         * The join style of the stroke.
         */
        join: CanvasLineJoin;

        /**
         * The dash offset of the stroke.
         */
        dashOffset: number;

        /**
         * The dash pattern of the stroke.
         */
        dash: number[];

        /**
         * The miter limit of the stroke.
         */
        miterLimit: number;
    };
}



export class PolygonLayer extends BaseLayer<IPolygonLayerProps> {
    props: IPolygonLayerProps;

    constructor(props?: IPolygonLayerProps, misc?: IBaseLayerMisc) {
        super(LayerType.Polygon, props || {} as IPolygonLayerProps, misc);
        this.props = props ? props : {} as IPolygonLayerProps;
        this.props = this.validateProps(this.props);
    }

    /**
     * Sets the size of the Polygon layer.
     * @param {ScaleType} [width] - The width of the Polygon layer.
     * @param {ScaleType} [height] - The height of the Polygon layer.
     * @param {number} [count] - The number of sides of the polygon.
     * @param {number} [radius] - The radius of the Polygon Layer (optional).
     * @returns {this} The current instance for chaining.
     */
    setSize(width: ScaleType, height: ScaleType, count: number, radius?: number): this {
        this.props.size = {
            width: width,
            height: height,
            count: count,
            radius: radius || 0,
        };
        return this;
    }

    /**
     * Sets the color of the Polygon layer.
     * @param {ColorType} [color] - The color of the layer.
     * @returns {this} The current instance for chaining.
     * @throws {LazyError} If the color is not provided or invalid.
     */
    setColor(color: ColorType): this {
        if (!color) throw new LazyError('The color of the layer must be provided');
        if (!isColor(color)) throw new LazyError('The color of the layer must be a valid color');
        this.props.fillStyle = color;
        return this;
    }

    /**
     * Sets the stroke properties of the Polygon Layer.
     * @param {number} [width] - The width of the stroke.
     * @param {string} [cap] - The cap style of the stroke.
     * @param {string} [join] - The join style of the stroke.
     * @param {number[]} [dash] - The dash pattern of the stroke.
     * @param {number} [dashOffset] - The dash offset of the stroke.
     * @param {number} [miterLimit] - The miter limit of the stroke.
     * @returns {this} The current instance for chaining.
     */
    setStroke(width: number, cap?: CanvasLineCap, join?: CanvasLineJoin, dash?: number[], dashOffset?: number, miterLimit?: number): this {
        this.props.stroke = {
            width,
            cap: cap || 'butt',
            join: join || 'miter',
            dash: dash || [],
            dashOffset: dashOffset || 0,
            miterLimit: miterLimit || 10,
        };
        this.props.filled = false; // Ensure filled is false when stroke is set
        return this;
    }

    /**
     * Draws the Polygon layer on the given canvas context.
     * @param {SKRSContext2D} [ctx] - The canvas rendering context.
     * @param {Canvas | SvgCanvas} [canvas] - The canvas instance.
     * @param {LayersManager} [manager] - The layer's manager.
     * @param {boolean} [debug] - Whether to enable debug logging.
     */
    async draw(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, debug: boolean): Promise<void> {
        const parcer = parser(ctx, canvas, manager);

        const { xs, ys, w } = parcer.parseBatch({
            xs: { v: this.props.x },
            ys: { v: this.props.y, options: defaultArg.vl(true) },
            w: { v: this.props.size.width },
        });

        const h = parcer.parse(this.props.size.height, defaultArg.wh(w), defaultArg.vl(true));

        let { x, y } = centring(this.props.centring, this.type, w, h, xs, ys);
        let fillStyle = await parseFillStyle(ctx, this.props.fillStyle, { debug, layer: { width: w, height: h, x: xs, y: ys, align: this.props.centring }, manager });

        if (debug) LazyLog.log('none', `PolygonLayer:`, { x, y, w, h, count: this.props.size.count, radius: this.props.size.radius } );

        ctx.save();
        ctx.beginPath();

        // Calculate polygon vertices
        const vertices: { x: number, y: number }[] = [];
        for (let i = 0; i < this.props.size.count; i++) {
            const angle = (i / this.props.size.count) * (2 * Math.PI) - Math.PI / 2;
            vertices.push({
                x: x + w / 2 + (w / 2) * Math.cos(angle),
                y: y + h / 2 + (h / 2) * Math.sin(angle)
            });
        }

        if (this.props.size.radius > 0) {
            // Draw polygon with rounded corners
            for (let i = 0; i < vertices.length; i++) {
                const current = vertices[i];
                const next = vertices[(i + 1) % vertices.length];
                const prev = vertices[(i - 1 + vertices.length) % vertices.length];

                // Calculate vectors from current vertex to adjacent vertices
                const dx1 = current.x - prev.x;
                const dy1 = current.y - prev.y;
                const dx2 = next.x - current.x;
                const dy2 = next.y - current.y;

                // Normalize vectors
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                const ndx1 = dx1 / len1;
                const ndy1 = dy1 / len1;
                const ndx2 = dx2 / len2;
                const ndy2 = dy2 / len2;

                // Calculate the maximum radius based on edge lengths
                const maxRadius = Math.max(len1 / 2, len2 / 2);
                const cornerRadius = Math.min(this.props.size.radius, maxRadius);

                // Calculate arc start and end points
                const arcStart = {
                    x: current.x - ndx1 * cornerRadius,
                    y: current.y - ndy1 * cornerRadius
                };
                const arcEnd = {
                    x: current.x + ndx2 * cornerRadius,
                    y: current.y + ndy2 * cornerRadius
                };

                if (i === 0) {
                    ctx.moveTo(arcStart.x, arcStart.y);
                } else {
                    ctx.lineTo(arcStart.x, arcStart.y);
                }

                // Draw arc at corner
                ctx.arcTo(current.x, current.y, arcEnd.x, arcEnd.y, cornerRadius);
            }
            ctx.closePath();
        } else {
            // Draw polygon without rounded corners (original behavior)
            for (let i = 0; i < vertices.length; i++) {
                if (i === 0) {
                    ctx.moveTo(vertices[i].x, vertices[i].y);
                } else {
                    ctx.lineTo(vertices[i].x, vertices[i].y);
                }
            }
            ctx.closePath();
        }

        if (this.props.filled) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }

        if (this.props.stroke && this.props.stroke.width > 0) {
            ctx.lineWidth = this.props.stroke.width;
            ctx.lineCap = this.props.stroke.cap;
            ctx.lineJoin = this.props.stroke.join;
            ctx.setLineDash(this.props.stroke.dash);
            ctx.lineDashOffset = this.props.stroke.dashOffset;
            ctx.miterLimit = this.props.stroke.miterLimit;
            ctx.strokeStyle = fillStyle;
            ctx.stroke();
        }

        ctx.restore();

    }


    /**
     * Converts the Polygon layer to a JSON representation.
     * @returns {IPolygonLayer} The JSON representation of the Polygon layer.
     */
    toJSON(): IPolygonLayer {
        let data = super.toJSON();
        let copy: any = { ...this.props };

        for (const key of ['x', 'y', 'size.width', 'size.height', 'fillStyle']) {
            if (copy[key] && typeof copy[key] === 'object' && 'toJSON' in copy[key]) {
                copy[key] = copy[key].toJSON();
            }
        }

        return { ...data, props: copy } as IPolygonLayer;
    }

    /**
     * Validates the properties of the Morph Layer.
     * @param {IPolygonLayerProps} [data] - The properties to validate.
     * @returns {IPolygonLayerProps} The validated properties.
     */
    protected validateProps(data: IPolygonLayerProps): IPolygonLayerProps {
        return {
            ...super.validateProps(data),
            size: {
                width: data.size?.width || 100,
                height: data.size?.height || 100,
                radius: data.size?.radius || 0,
                count: data.size?.count || 3
            },
            filled: data.filled !== undefined ? data.filled : true,
            fillStyle: data.fillStyle || '#000000',
            stroke: {
                width: data.stroke?.width || 1,
                cap: data.stroke?.cap || 'butt',
                join: data.stroke?.join || 'miter',
                dashOffset: data.stroke?.dashOffset || 0,
                dash: data.stroke?.dash || [],
                miterLimit: data.stroke?.miterLimit || 10
            }
        }
    }
}
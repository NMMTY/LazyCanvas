import type { AnyCentring, AnyLayer, AnyTextAlign, ColorType, PointNumber, ScaleType, Transform } from "../types";
import { Centring, LayerType, LinkType, TextAlign } from "../types";
import { Gradient, Link, Pattern } from "../structures/helpers";
import { Canvas, loadImage, SKRSContext2D, SvgCanvas } from "@napi-rs/canvas";
import { defaultArg, LazyError } from "./LazyUtil";
import { LayersManager } from "../structures/managers";
import { BezierLayer, Group, LineLayer, Path2DLayer, QuadraticLayer, TextLayer } from "../structures/components";

export function generateID(type: string) {
    return `${type}-${Math.random().toString(36).substr(2, 9)}`;
}

let percentReg = /^(\d+)%$/;
let pxReg = /^(\d+)px$/;
let canvasReg = /^(vw|vh|vmin|vmax)$/;
let linkReg = /^(link-w|link-h|link-x|link-y)-([A-Za-z0-9_]+)-(\d+(.\d+)?)$/;

let hexReg = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
let rgbReg = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
let rgbaReg = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(0|0?\.\d+|1(\.0)?)\)$/;
let hslReg = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/;
let hslaReg = /^hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*(0|0?\.\d+|1(\.0)?)\)$/;

export function isColor(v: ColorType) {
    return typeof (v === 'string' && (hexReg.test(v) || rgbReg.test(v) || rgbaReg.test(v) || hslReg.test(v) || hslaReg.test(v))) || v instanceof Gradient || v instanceof Pattern;
}

export function parseToNormal(
    v: ScaleType,
    ctx: SKRSContext2D,
    canvas: Canvas | SvgCanvas,
    layer: { width: number; height: number } = { width: 0, height: 0 },
    options: { vertical?: boolean; layer?: boolean } = { vertical: false, layer: false },
    manager?: LayersManager
): number {
    if (typeof v === 'number') return v;

    if (typeof v === 'string') {
        if (percentReg.test(v)) {
            const base = options.layer
                ? options.vertical ? layer.height : layer.width
                : options.vertical ? canvas.height : canvas.width;
            return (parseFloat(v) / 100) * base;
        }
        if (pxReg.test(v)) return parseFloat(v);

        if (canvasReg.test(v)) {
            const base = options.layer ? layer : canvas;
            switch (v) {
                case 'vw': return base.width;
                case 'vh': return base.height;
                case 'vmin': return Math.min(base.width, base.height);
                case 'vmax': return Math.max(base.width, base.height);
            }
        }

        if (linkReg.test(v)) {
            const match = v.match(linkReg) as RegExpMatchArray;
            if (!manager) return 0;

            const anyLayer = manager.get(match[2], true);
            if (!anyLayer || anyLayer instanceof Group || anyLayer instanceof Path2DLayer) return 0;

            const parserInstance = parser(ctx, canvas, manager);
            const additionalSpacing = parseInt(match[3]) || 0;

            switch (match[1]) {
                case 'link-w': return getLayerWidth(anyLayer, ctx, canvas, manager, parserInstance) + additionalSpacing;
                case 'link-h': return getLayerHeight(anyLayer, ctx, canvas, manager, parserInstance) + additionalSpacing;
                case 'link-x': return parserInstance.parse(anyLayer.props.x) + additionalSpacing;
                case 'link-y': return parserInstance.parse(anyLayer.props.y) + additionalSpacing;
            }
        }
    }

    if (v instanceof Link) {
        if (!manager) return 0;

        const anyLayer = manager.get(v.source, true);
        if (!anyLayer || anyLayer instanceof Group || anyLayer instanceof Path2DLayer) return 0;

        const parserInstance = parser(ctx, canvas, manager);
        const additionalSpacing = parserInstance.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0;

        switch (v.type) {
            case LinkType.Width: return getLayerWidth(anyLayer, ctx, canvas, manager, parserInstance) + additionalSpacing;
            case LinkType.Height: return getLayerHeight(anyLayer, ctx, canvas, manager, parserInstance) + additionalSpacing;
            case LinkType.X: return parserInstance.parse(anyLayer.props.x) + additionalSpacing;
            case LinkType.Y: return parserInstance.parse(anyLayer.props.y) + additionalSpacing;
        }
    }

    return 0;
}

function getLayerWidth(anyLayer: AnyLayer, ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, parserInstance: any): number {
    if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
        return anyLayer.getBoundingBox(ctx, canvas, manager).width;
    }
    if (anyLayer instanceof TextLayer) {
        return anyLayer.measureText(ctx, canvas).width;
    }
    return anyLayer instanceof Path2DLayer ? 0 : parserInstance.parse(anyLayer.props.size.width) || 0;
}

function getLayerHeight(anyLayer: AnyLayer, ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager: LayersManager, parserInstance: any): number {
    if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
        return anyLayer.getBoundingBox(ctx, canvas, manager).height;
    }
    if (anyLayer instanceof TextLayer) {
        return anyLayer.measureText(ctx, canvas).height;
    }
    return anyLayer instanceof Path2DLayer ? 0 : parserInstance.parse(anyLayer.props.size.height) || 0;
}

export function parser(ctx: SKRSContext2D, canvas: Canvas | SvgCanvas, manager?: LayersManager) {
    return {
        parse(v: ScaleType, layer: { width: number, height: number } = defaultArg.wh(), options: { vertical?: boolean, layer?: boolean } = defaultArg.vl()) {
            return parseToNormal(v, ctx, canvas, layer, options, manager);
        },
        parseBatch(values: Record<string, { v: ScaleType; layer?: { width: number; height: number }; options?: { vertical?: boolean; layer?: boolean } }>) {
            const result: Record<string, number> = {};
            for (const key in values) {
                const { v, layer, options } = values[key];
                result[key] = parseToNormal(v, ctx, canvas, layer ?? defaultArg.wh(), options ?? defaultArg.vl(), manager);
            }
            return result;
        }
    };
}


export function drawShadow(ctx: SKRSContext2D, shadow: any) {
    if (shadow) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur || 0;
        ctx.shadowOffsetX = shadow.offsetX || 0;
        ctx.shadowOffsetY = shadow.offsetY || 0;
    }
}

export function opacity(ctx: SKRSContext2D, opacity: number = 1) {
    if (opacity < 1) {
        ctx.globalAlpha = opacity;
    }
}

export function filters(ctx: SKRSContext2D, filters: string | null | undefined) {
    if (filters) {
        ctx.filter = filters;
    }
}

export function parseFillStyle(ctx: SKRSContext2D, color: ColorType, opts: { debug?: boolean, layer?: { width: number, height: number, x: number, y: number, align: AnyCentring }, manager?: LayersManager }) {
    if (!ctx) throw new LazyError('The context is not defined');
    if (!color) throw new LazyError('The color is not defined');

    if (color instanceof Gradient || color instanceof Pattern) {
        return color.draw(ctx, opts);
    }
    return color;
}

export function transform(ctx: SKRSContext2D, transform: Transform, layer: { width: number, height: number, x: number, y: number, type: LayerType } = { width: 0, height: 0, x: 0, y: 0, type: LayerType.Morph }, extra: { text: string, textAlign: AnyTextAlign, fontSize: number, multiline: boolean} = { text: '', textAlign: TextAlign.Left, fontSize: 0, multiline: false }) {
    if (transform) {
        if (transform.translate) {
            ctx.translate(transform.translate.x, transform.translate.y);
        }
        if (transform.rotate) {
            switch (layer.type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.BezierCurve:
                case LayerType.QuadraticCurve:
                case LayerType.Line:
                    ctx.translate(layer.x + (layer.width / 2), layer.y + (layer.height / 2));
                    ctx.rotate((Math.PI / 180) * transform.rotate);
                    ctx.translate(-(layer.x + (layer.width / 2)), -(layer.y + (layer.height / 2)));
                    break;
                case LayerType.Text:
                    if (extra.multiline) {
                        ctx.translate(layer.x + (layer.width / 2), layer.y + (layer.height / 2));
                        ctx.rotate((Math.PI/180) * transform.rotate);
                        ctx.translate(-(layer.x + (layer.width / 2)), -(layer.y + (layer.height / 2)));
                    } else {
                        if (extra.textAlign === TextAlign.Center) {
                            ctx.translate(layer.x, layer.y);
                            ctx.rotate((Math.PI/180) * transform.rotate);
                            ctx.translate(-layer.x, -layer.y);
                        } else if (extra.textAlign === TextAlign.Left || extra.textAlign === TextAlign.Start) {
                            ctx.translate(layer.x + (extra.fontSize * extra.text.length) / 2, layer.y);
                            ctx.rotate((Math.PI/180) * transform.rotate);
                            ctx.translate(-(layer.x + (extra.fontSize * extra.text.length) / 2), -layer.y);
                        } else if (extra.textAlign === TextAlign.Right || extra.textAlign === TextAlign.End) {
                            ctx.translate(layer.x - (extra.fontSize * extra.text.length) / 2, layer.y);
                            ctx.rotate((Math.PI/180) * transform.rotate);
                            ctx.translate(-(layer.x - (extra.fontSize * extra.text.length) / 2), -layer.y);
                        }
                    }
                    break;
            }
        }
        if (transform.scale) {
            ctx.scale(transform.scale.x, transform.scale.y);
        }
        if (transform.matrix) {
            if (!transform.matrix.a || !transform.matrix.b || !transform.matrix.c || !transform.matrix.d || !transform.matrix.e || !transform.matrix.f) throw new LazyError('The matrix transformation must be a valid matrix');
            ctx.transform(transform.matrix.a, transform.matrix.b, transform.matrix.c, transform.matrix.d, transform.matrix.e, transform.matrix.f);
        }
    }
}

export function generateRandomName() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function isImageUrlValid(src: string) {
    try {
        loadImage(src);
        return true;
    } catch (error) {
        return false;
    }
}

export function centring(centring: AnyCentring, type: LayerType, width: number, height: number, x: number, y: number) {
    switch (centring) {
        case Centring.Center:
        case "center":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width / 2;
                    y -= height / 2;
                    break;
            }
            return { x, y };
        case Centring.CenterBottom:
        case "center-bottom":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width / 2;
                    y -= height;
                    break;
            }
            return { x, y };
        case Centring.CenterTop:
        case "center-top":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width / 2;
                    y -= height;
                    break;
            }
            return { x, y };
        case Centring.Start:
        case "start":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    y -= height / 2;
                    break;
            }
            return { x, y };
        case Centring.StartBottom:
        case "start-bottom":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    y -= height;
                    break;
            }
            return { x, y };
        case Centring.StartTop:
        case "start-top":
            return { x, y };
        case Centring.End:
        case "end":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width;
                    y -= height / 2;
                    break;
            }
            return { x, y };
        case Centring.EndBottom:
        case "end-bottom":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width;
                    y -= height;
                    break;
            }
            return { x, y };
        case Centring.EndTop:
        case "end-top":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                case LayerType.Clear:
                    x -= width;
                    break;
            }
            return { x, y };
        case Centring.None:
        case "none":
            return { x, y };
    }
}

function quadraticBezier(p0: PointNumber, p1: PointNumber, p2: PointNumber, t: number): PointNumber {
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
    return { x, y };
}

function cubicBezier(p0: PointNumber, p1: PointNumber, p2: PointNumber, p3: PointNumber, t: number): PointNumber {
    const x = (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t ** 2 * p2.x + t ** 3 * p3.x;
    const y = (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t ** 2 * p2.y + t ** 3 * p3.y;
    return { x, y };
}

export function getBoundingBoxBezier(points: PointNumber[], steps = 100) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let p: PointNumber;

        if (points.length === 3) {
            p = quadraticBezier(points[0], points[1], points[2], t);
        } else if (points.length === 4) {
            p = cubicBezier(points[0], points[1], points[2], points[3], t);
        } else {
            throw new LazyError("Invalid number of points");
        }

        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY }, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, width: maxX - minX, height: maxY - minY };
}

export function resize(value: ScaleType, ratio: number): number | string {
    if (typeof value === 'number') {
        return value * ratio;
    } else if (typeof value === 'string') {
        if (pxReg.test(value)) {
            return parseFloat(value) * ratio;
        } else if (linkReg.test(value)) {
            let match = value.match(linkReg) as RegExpMatchArray;
            return `${match[1]}-${match[2]}-${parseFloat(match[3]) * ratio}`;
        }
    } else if (value instanceof Link) {
        return `${value.type}-${value.source}-${resize(value.additionalSpacing, ratio)}`;
    }
    return value;
}

export function resizeLayers(layers: Array<AnyLayer | Group>, ratio: number) {
    let newLayers: Array<AnyLayer | Group> = [];
    if (layers.length > 0) {
        for (const layer of layers) {
            if (!(layer instanceof Group || layer instanceof Path2DLayer)) {
                layer.props.x = resize(layer.props.x, ratio) as ScaleType;
                layer.props.y = resize(layer.props.y, ratio) as ScaleType;

                if ('size' in layer.props) {
                    layer.props.size.width = resize(layer.props.size.width, ratio) as ScaleType;
                    layer.props.size.height = resize(layer.props.size.height, ratio) as ScaleType;
                    if ('radius' in layer.props.size) {
                        for (const corner in layer.props.size.radius) {
                            // @ts-ignore
                            layer.props.size.radius[corner] = resize(layer.props.size.radius[corner], ratio) as ScaleType;
                        }
                    }
                }

                if ('stroke' in layer.props && layer.props.stroke) {
                    layer.props.stroke.width = resize(layer.props.stroke.width, ratio) as number;
                }

                if ('endPoint' in layer.props) {
                    layer.props.endPoint.x = resize(layer.props.endPoint.x, ratio) as ScaleType;
                    layer.props.endPoint.y = resize(layer.props.endPoint.y, ratio) as ScaleType;
                }

                if ('controlPoints' in layer.props) {
                    for (const point of layer.props.controlPoints) {
                        point.x = resize(point.x, ratio) as ScaleType;
                        point.y = resize(point.y, ratio) as ScaleType;
                    }
                }

                if ('font' in layer.props) {
                    layer.props.font.size = resize(layer.props.font.size, ratio) as number;
                }

                if ('transform' in layer.props) {
                    if (layer.props.transform.translate) {
                        layer.props.transform.translate.x = resize(layer.props.transform.translate.x, ratio) as number;
                        layer.props.transform.translate.y = resize(layer.props.transform.translate.y, ratio) as number;
                    }
                    if (layer.props.transform.scale) {
                        layer.props.transform.scale.x = resize(layer.props.transform.scale.x, ratio) as number;
                        layer.props.transform.scale.y = resize(layer.props.transform.scale.y, ratio) as number;
                    }
                }
            } else if (layer instanceof Group) {
                layer.layers = resizeLayers(layer.layers, ratio);
            }
            newLayers.push(layer)
        }
    }
    return newLayers;
}
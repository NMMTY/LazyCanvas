import { Centring, LayerType, LinkType, TextAlign } from "../types/enum";
import { Transform, ScaleType, ColorType, PointNumber, AnyCentring, AnyTextAlign, AnySaveFormat } from "../types";
import { Gradient } from "../structures/helpers/Gradient";
import { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import { defaultArg, LazyError } from "./LazyUtil";
import * as fs from "fs";
import * as jimp from "jimp";
import { Pattern } from "../structures/helpers/Pattern";
import { LayersManager } from "../structures/managers/LayersManager";
import { Link } from "../structures/helpers/Link";
import { Group } from "../structures/components/Group";
import { LineLayer } from "../structures/components/LineLayer";
import { BezierLayer } from "../structures/components/BezierLayer";
import { QuadraticLayer } from "../structures/components/QuadraticLayer";
import { TextLayer } from "../structures/components/TextLayer";

export function generateID(type: string) {
    return `${type}-${Math.random().toString(36).substr(2, 9)}`;
}

let percentReg = /^(\d+)%$/;
let pxReg = /^(\d+)px$/;
let canvasReg = /^(vw|vh|vmin|vmax)$/;
let linkReg = /^(link-w|link-h|link-x|link-y)-([A-Za-z0-9_]+)-(\d+)$/;

let hexReg = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
let rgbReg = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
let rgbaReg = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(0|0?\.\d+|1(\.0)?)\)$/;
let hslReg = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/;
let hslaReg = /^hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*(0|0?\.\d+|1(\.0)?)\)$/;

export function isColor(v: ColorType) {
    return typeof (v === 'string' && (hexReg.test(v) || rgbReg.test(v) || rgbaReg.test(v) || hslReg.test(v) || hslaReg.test(v))) || v instanceof Gradient || v instanceof Pattern;
}

function tooShort(v: string) {
    return v.length < 2 ? `0${v}` : v;
}

export function parseHex(v: string) {
    if (hexReg.test(v)) {
        return v;
    } else if (rgbReg.test(v)) {
        let match = v.match(rgbReg) as RegExpMatchArray;
        let r = parseInt(match[1]);
        let g = parseInt(match[2]);
        let b = parseInt(match[3]);
        return `#${tooShort(r.toString(16))}${tooShort(g.toString(16))}${tooShort(b.toString(16))}`;
    } else if (rgbaReg.test(v)) {
        let match = v.match(rgbaReg) as RegExpMatchArray;
        let r = parseInt(match[1]);
        let g = parseInt(match[2]);
        let b = parseInt(match[3]);
        let a = parseFloat(match[4]);
        return `#${tooShort(r.toString(16))}${tooShort(g.toString(16))}${tooShort(b.toString(16))}:${a}`;
    } else if (hslReg.test(v)) {
        let match = v.match(hslReg) as RegExpMatchArray;
        let h = parseInt(match[1]);
        let s = parseInt(match[2]);
        let l = parseInt(match[3]);
        l /= 100;
        const b = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - b * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    } else if (hslaReg.test(v)) {
        let match = v.match(hslaReg) as RegExpMatchArray;
        let h = parseInt(match[1]);
        let s = parseInt(match[2]);
        let l = parseInt(match[3]);
        let a = parseFloat(match[4]);
        l /= 100;
        const b = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - b * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}:${a}`;
    } else {
        return '#000000';
    }
}

export function parseColor(v: ColorType) {
    if (typeof v === 'string') {
        return parseHex(v);
    } else if (v instanceof Gradient || v instanceof Pattern) {
        return v;
    } else {
        return '#000000';
    }
}

export function parseToNormal(v: ScaleType, ctx: SKRSContext2D, canvas: Canvas, layer: { width: number, height: number } = { width: 0, height: 0 }, options: { vertical?: boolean, layer?: boolean } = { vertical: false, layer: false }, manager?: LayersManager): number {
    if (typeof v === 'number') {
        return v;
    } else if (typeof v === 'string') {
        if (percentReg.test(v)) {
            return (parseFloat(v) / 100) * (options.layer ? (options.vertical ? layer.width : layer.height) : (options.vertical ? canvas.width : canvas.height));
        } else if (pxReg.test(v)) {
            return parseFloat(v);
        } else if (canvasReg.test(v)) {
            if (v === 'vw') {
                return (options.layer ? layer.width : canvas.width);
            } else if (v === 'vh') {
                return (options.layer ? layer.height : canvas.height);
            } else if (v === 'vmin') {
                return (options.layer ? Math.max(layer.width, layer.height) : Math.min(canvas.width, canvas.height));
            } else if (v === 'vmax') {
                return (options.layer ? Math.max(layer.width, layer.height) : Math.max(canvas.width, canvas.height));
            }
        } else if (linkReg.test(v)) {
            let match = v.match(linkReg) as RegExpMatchArray;
            if (!manager) return 0;
            let anyLayer = manager.get(match[2], true);
            const parcer = parser(ctx, canvas, manager);
            switch (match[1]) {
                case 'link-w':
                    if (anyLayer && !(anyLayer instanceof Group)) {
                        if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
                            return anyLayer.getBoundingBox(ctx, canvas, manager).width + (parseInt(match[3]) || 0);
                        } else if (anyLayer instanceof TextLayer) {
                            return anyLayer.measureText(ctx, canvas).width + (parseInt(match[3]) || 0);
                        } else {
                            return (parcer.parse(anyLayer.props.size.width) || 0) + (parseInt(match[3]) || 0);
                        }
                    } else {
                        return 0;
                    }
                    break;
                case 'link-h':
                    if (anyLayer && !(anyLayer instanceof Group)) {
                        if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
                            return anyLayer.getBoundingBox(ctx, canvas, manager).height + (parseInt(match[3]) || 0);
                        } else if (anyLayer instanceof TextLayer) {
                            return anyLayer.measureText(ctx, canvas).height + (parseInt(match[3]) || 0);
                        } else {
                            return (parcer.parse(anyLayer.props.size.height, defaultArg.wh(parcer.parse(anyLayer.props.size.width)), defaultArg.vl(true)) || 0) + (parseInt(match[3]) || 0);
                        }
                    } else {
                        return 0;
                    }
                    break;
                case 'link-x':
                    if (anyLayer && !(anyLayer instanceof Group)) {
                        return (parcer.parse(anyLayer.props.x) || 0) + (parseInt(match[3]) || 0);
                    } else {
                        return 0;
                    }
                    break;
                case 'link-y':
                    if (anyLayer && !(anyLayer instanceof Group)) {
                        return (parcer.parse(anyLayer.props.y, defaultArg.wh(), defaultArg.vl(true)) || 0) + (parseInt(match[3]) || 0);
                    } else {
                        return 0;
                    }
                    break;
            }
        }
    } else if (v instanceof Link) {
        if (!manager) return 0;
        let anyLayer = manager.get(v.source, true);
        const parcer = parser(ctx, canvas, manager);
        switch (v.type) {
            case LinkType.Width:
            case 'width':
                if (anyLayer && !(anyLayer instanceof Group)) {
                    if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
                        return anyLayer.getBoundingBox(ctx, canvas, manager).width + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    } else if (anyLayer instanceof TextLayer) {
                        return anyLayer.measureText(ctx, canvas).width + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    } else {
                        return (parcer.parse(anyLayer.props.size.width) || 0) + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    }
                } else {
                    return 0;
                }
                break;
            case LinkType.Height:
            case 'height':
                if (anyLayer && !(anyLayer instanceof Group)) {
                    if (anyLayer instanceof LineLayer || anyLayer instanceof BezierLayer || anyLayer instanceof QuadraticLayer) {
                        return anyLayer.getBoundingBox(ctx, canvas, manager).height + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    } else if (anyLayer instanceof TextLayer) {
                        return anyLayer.measureText(ctx, canvas).height + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    } else {
                        return (parcer.parse(anyLayer.props.size.height, defaultArg.wh(parcer.parse(anyLayer.props.size.width)), defaultArg.vl(true)) || 0) + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                    }
                } else {
                    return 0;
                }
                break;
            case LinkType.X:
            case 'x':
                if (anyLayer && !(anyLayer instanceof Group)) {
                    return (parcer.parse(anyLayer.props.x) || 0) + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                } else {
                    return 0;
                }
                break;
            case LinkType.Y:
            case 'y':
                if (anyLayer && !(anyLayer instanceof Group)) {
                    return (parcer.parse(anyLayer.props.y) || 0) + (parcer.parse(v.additionalSpacing, defaultArg.wh(layer.width, layer.height), defaultArg.vl(options.vertical, options.layer)) || 0);
                } else {
                    return 0;
                }
                break;
            default:
                return 0;
        }
    } else {
        return 0;
    }
    return 0;
}

export function parser(ctx: SKRSContext2D, canvas: Canvas, manager?: LayersManager) {
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

export function opacity(ctx: SKRSContext2D, opacity: number) {
    if (opacity < 1) {
        ctx.globalAlpha = opacity;
    }
}

export function filters(ctx: SKRSContext2D, filters: string) {
    if (filters) {
        ctx.filter = filters;
    }
}

export function parseFillStyle(ctx: SKRSContext2D, color: ColorType) {
    if (color instanceof Gradient || color instanceof Pattern) {
        return color.draw(ctx);
    } else {
        return color;
    }
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

export async function saveFile(buffer: any, extension: AnySaveFormat, name: string) {
    if (!buffer) throw new LazyError('Buffer must be provided');
    if (!extension) throw new LazyError('Extension must be provided');

    fs.writeFileSync(`${name === undefined ? generateRandomName() : name }.${extension}`, buffer);
}

export function generateRandomName() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function isImageUrlValid(src: string) {
    try {
        jimp.read(src);
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
                    x -= width / 2;
                    break;
            }
            return { x, y };
        case Centring.CenterTop:
        case "center-top":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
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
                    y -= height / 2;
                    break;
            }
            return { x, y };
        case Centring.StartBottom:
        case "start-bottom":
            return { x, y };
        case Centring.StartTop:
        case "start-top":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                    y -= height;
                    break;
            }
            return { x, y };
        case Centring.End:
        case "end":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
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
                    x -= width;
                    break;
            }
            return { x, y };
        case Centring.EndTop:
        case "end-top":
            switch (type) {
                case LayerType.Image:
                case LayerType.Morph:
                    x -= width;
                    y -= height;
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

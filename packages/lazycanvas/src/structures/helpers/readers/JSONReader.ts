import { AnyLayer, JSONLayer, LayerType } from "../../../types";
import {
    BezierLayer,
    ClearLayer,
    Group,
    IBaseLayerMisc,
    IBezierLayerProps,
    IClearLayerProps,
    IGroup,
    IImageLayerProps,
    ILineLayerProps,
    ImageLayer,
    IMorphLayerProps,
    IPath2DLayerProps, IPolygonLayerProps,
    IQuadraticLayerProps,
    ITextLayerProps,
    LineLayer,
    MorphLayer, Path2DLayer, PolygonLayer,
    QuadraticLayer,
    TextLayer
} from "../../components";
import { Gradient, IGradient, IPattern, Pattern } from "../";
import { IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import * as fs from "fs";
import { LazyError, LazyLog } from "../../../utils/LazyUtil";
import * as path from "path";

/**
 * Class responsible for reading and parsing JSON data into a LazyCanvas instance.
 */
export class JSONReader {
    /**
     * Reads JSON data and converts it into a LazyCanvas instance.
     * @param {IOLazyCanvas} [data] - The JSON data to read.
     * @param {Object} [opts] - Optional settings.
     * @param {boolean} [opts.debug] - Whether to enable debug logging.
     * @returns {LazyCanvas} The created LazyCanvas instance.
     * @throws {LazyError} If the data contains invalid options or no layers are found.
     */
    static read(data: IOLazyCanvas, opts?: { debug?: boolean }): LazyCanvas {
        if (data.options.width <= 0 || data.options.height <= 0) {
            throw new LazyError("Invalid width or height");
        }

        if (data.options.exportType === undefined) {
            throw new LazyError("Invalid export type");
        }

        if (data.options.flag === undefined) {
            throw new LazyError("Invalid export flag");
        }

        if (data.layers === undefined || data.layers.length === 0) {
            throw new LazyError("No layers found");
        }

        if (opts?.debug) LazyLog.log("info", "Reading JSON...\nOptions:", data.options, "\nAnimation:", data.animation, "\nLayers Number:", data.layers.length, "\nLayers:", data.layers);

        const layers = JSONReader.layersParse(data.layers, opts);

        const canvas = new LazyCanvas({ settings: data, debug: opts?.debug })
            .create(data.options.width, data.options.height);
        canvas.manager.layers.add(...layers);

        return canvas;
    }

    /**
     * Reads a JSON file and converts it into a LazyCanvas instance.
     * @param {string} [file] - The path to the JSON file.
     * @param {Object} [opts] - Optional settings.
     * @param {boolean} [opts.debug] - Whether to enable debug logging.
     * @returns {LazyCanvas} The created LazyCanvas instance.
     * @throws {LazyError} If the file does not exist.
     */
    static readFile(file: string, opts?: { debug?: boolean }): LazyCanvas {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) throw new LazyError("File not found");
        const json = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(json) as IOLazyCanvas;

        if (opts?.debug) LazyLog.log("info", "Reading JSON file...\nFile:", filePath, "\nData:", data);

        return JSONReader.read(data, opts);
    }

    /**
     * Parses an array of JSON layers into an array of AnyLayer or Group instances.
     * @param {Array<JSONLayer | Group>} [data] - The array of JSON layers to parse.
     * @param {Object} [opts] - Optional settings.
     * @param {boolean} [opts.debug] - Whether to enable debug logging.
     * @returns {Array<AnyLayer | Group>} The parsed layers.
     */
    private static layersParse(data: Array<JSONLayer | Group>, opts?: { debug?: boolean }): Array<AnyLayer | Group> {
        return data.map((layer: any) => {
            if (opts?.debug) LazyLog.log('info', `Parsing layer ${layer.id}...\nData:`, layer);
            const misc = {
                id: layer.id,
                zIndex: layer.zIndex,
                visible: layer.visible,
            }
            if (layer.type === LayerType.Group) {
                return new Group(misc).add(...layer.layers.map((l: any) => this.layerParse(l, { id: l.id, zIndex: l.zIndex, visible: l.visible })));
            } else {
                return this.layerParse(layer, misc);
            }
        });
    }

    /**
     * Parses a single JSON layer into an AnyLayer or Group instance.
     * @param {JSONLayer | IGroup | Group} [layer] - The JSON layer to parse.
     * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
     * @returns {AnyLayer | Group} The parsed layer.
     */
    private static layerParse(layer: JSONLayer | IGroup | Group, misc?: IBaseLayerMisc): AnyLayer | Group {
        if (layer instanceof Group) {
            return new Group(misc).add(...layer.layers.map((l: any) => this.layerParse(l)) as AnyLayer[]);
        } else {
            switch (layer.type) {
                case LayerType.BezierCurve:
                    return new BezierLayer(layer.props as IBezierLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.QuadraticCurve:
                    return new QuadraticLayer(layer.props as IQuadraticLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Image:
                    return new ImageLayer(layer.props as IImageLayerProps, misc);
                case LayerType.Text:
                    return new TextLayer(layer.props as ITextLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Morph:
                    return new MorphLayer(layer.props as IMorphLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Line:
                    return new LineLayer(layer.props as ILineLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Clear:
                    return new ClearLayer(layer.props as IClearLayerProps, misc);
                case LayerType.Path:
                    return new Path2DLayer(layer.props as IPath2DLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Polygon:
                    return new PolygonLayer(layer.props as IPolygonLayerProps, misc).setColor(this.fillParse(layer));
                case LayerType.Group:
                    return new Group(misc)
                        .add(...((layer as unknown as IGroup).layers.map((l: any) => this.layerParse(l)) as AnyLayer[]));
                default:
                    return layer as AnyLayer;
            }
        }
    }

    /**
     * Parses the fill style of a layer.
     * @param {JSONLayer} [layer] - The layer whose fill style is to be parsed.
     * @returns {string | Gradient | Pattern} The parsed fill style.
     */
    private static fillParse(layer: JSONLayer): string | Gradient | Pattern {
        if ('fillStyle' in layer.props && layer.props.fillStyle && typeof layer.props.fillStyle !== 'string') {
            switch (layer.props.fillStyle?.fillType) {
                case 'gradient':
                    return new Gradient({ props: layer.props.fillStyle as IGradient });
                case 'pattern':
                    return new Pattern()
                        .setType((layer.props.fillStyle as IPattern).type)
                        .setSrc(typeof (layer.props.fillStyle as IPattern).src === 'string' ? (layer.props.fillStyle as IPattern).src : this.read((layer.props.fillStyle as IPattern).src as unknown as IOLazyCanvas));
                default:
                    return layer.props.fillStyle;
            }
        } else if ('fillStyle' in layer.props) {
            console.log(layer.type, layer);
            return layer.props.fillStyle || '#000000';
        } else {
            return '#000000';
        }
    }
}
import { AnyLayer, JSONLayer, LayerType } from "../../../types";
import {
  BezierLayer,
  Div,
  IBaseLayerMisc,
  IBezierLayerProps,
  IDiv,
  IImageLayerProps,
  ILineLayerProps,
  ImageLayer,
  IMorphLayerProps,
  IPath2DLayerProps,
  IPolygonLayerProps,
  IQuadraticLayerProps,
  ITextLayerProps,
  LineLayer,
  MorphLayer,
  Path2DLayer,
  PolygonLayer,
  QuadraticLayer,
  TextLayer,
} from "../../components";
import { Gradient, IGradient, IPattern, Pattern } from "../";
import { IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import * as fs from "node:fs";
import { LazyError, LazyLog } from "../../../utils/LazyUtil";
import * as path from "node:path";
import { isSignal } from "../../../core/Signal";

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

    if (data.layers === undefined || data.layers.length === 0) {
      throw new LazyError("No layers found");
    }

    if (opts?.debug)
      LazyLog.log(
        "info",
        "Reading JSON...\nOptions:",
        data.options,
        "\nLayers Number:",
        data.layers.length,
        "\nLayers:",
        data.layers,
      );

    const layers = JSONReader.layersParse(data.layers, opts);

    const canvas = new LazyCanvas({ settings: data, debug: opts?.debug }).create(
      data.options.width,
      data.options.height,
    );
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
   * @param {Array<JSONLayer | Div>} [data] - The array of JSON layers to parse.
   * @param {Object} [opts] - Optional settings.
   * @param {boolean} [opts.debug] - Whether to enable debug logging.
   * @returns {Array<AnyLayer | Div>} The parsed layers.
   */
  private static layersParse(
    data: Array<JSONLayer | IDiv>,
    opts?: { debug?: boolean },
  ): Array<AnyLayer | Div> {
    return data.map((layer: any) => {
      if (opts?.debug) LazyLog.log("info", `Parsing layer ${layer.id}...\nData:`, layer);
      return this.layerParse(layer, {
        id: layer.id,
        zIndex: layer.zIndex,
        visible: layer.visible,
      });
    });
  }

  /**
   * Parses a single JSON layer into an AnyLayer or Group instance.
   * @param {JSONLayer | IDiv | Div} [layer] - The JSON layer to parse.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   * @returns {AnyLayer | Div} The parsed layer.
   */
  private static layerParse(layer: JSONLayer | IDiv | Div, misc?: IBaseLayerMisc): AnyLayer | Div {
    if (layer instanceof Div) {
      return new Div(misc).add(...(layer.layers.map((l: any) => this.layerParse(l)) as AnyLayer[]));
    } else {
      switch (layer.type) {
        case LayerType.BezierCurve:
          return new BezierLayer(layer.props as IBezierLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.QuadraticCurve:
          return new QuadraticLayer(layer.props as IQuadraticLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Image:
          return new ImageLayer(layer.props as IImageLayerProps, misc);
        case LayerType.Text:
          return new TextLayer(layer.props as ITextLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Morph:
          return new MorphLayer(layer.props as IMorphLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Line:
          return new LineLayer(layer.props as ILineLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Path:
          return new Path2DLayer(layer.props as IPath2DLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Polygon:
          return new PolygonLayer(layer.props as IPolygonLayerProps, misc).setColor(
            this.fillParse(layer),
          );
        case LayerType.Group:
          return new Div(misc).add(
            ...(layer as unknown as IDiv).layers.map((l: any) => this.layerParse(l)),
          );
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
    if ("fillStyle" in layer.props) {
      if (isSignal<string>(layer.props.fillStyle)) {
        throw new LazyError("Signals are not supported in JSON fill styles");
      }
      if (typeof layer.props.fillStyle === "object") {
        switch (layer.props.fillStyle?.fillType) {
          case "gradient":
            return new Gradient({ props: layer.props.fillStyle as IGradient });
          case "pattern":
            return new Pattern()
              .setType((layer.props.fillStyle as IPattern).type)
              .setSrc(
                typeof (layer.props.fillStyle as IPattern).src === "string"
                  ? (layer.props.fillStyle as IPattern).src
                  : this.read((layer.props.fillStyle as IPattern).src as unknown as IOLazyCanvas),
              );
          default:
            return layer.props.fillStyle;
        }
      }
      return layer.props.fillStyle || "#000000";
    } else {
      return "#000000";
    }
  }
}

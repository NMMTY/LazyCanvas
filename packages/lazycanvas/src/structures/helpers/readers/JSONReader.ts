import { Gradient, type IGradient, type IPattern, Pattern } from "../";
import { isSignal } from "../../../core";
import { type AnyLayer, type ICanvasAdapter, type JSONLayer, LayerType } from "../../../types";
import { LazyError, LazyLog } from "../../../utils";
import { type IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import {
  Bezier,
  Group,
  type IBaseLayerMisc,
  type IBezierProps,
  type IGroup,
  type IImageProps,
  type ILineProps,
  type IMorphProps,
  type IPath2DProps,
  type IPolygonProps,
  type IQuadraticProps,
  type ITextProps,
  Image,
  Line,
  Morph,
  Path2D,
  Polygon,
  Quadratic,
  Text,
} from "../../components";
import { ClassicRenderPipeline } from "../../managers";

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
  static read(
    data: IOLazyCanvas,
    opts?: { debug?: boolean; adapter?: ICanvasAdapter },
  ): LazyCanvas {
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

    const canvas = new LazyCanvas(ClassicRenderPipeline, {
      settings: data,
      debug: opts?.debug,
      adapter: opts?.adapter,
    }).create(data.options.width, data.options.height);
    canvas.manager.layers.add(...layers);

    return canvas;
  }

  /**
   * Parses an array of JSON layers into an array of AnyLayer or Group instances.
   * @param {Array<JSONLayer | Group>} [data] - The array of JSON layers to parse.
   * @param {Object} [opts] - Optional settings.
   * @param {boolean} [opts.debug] - Whether to enable debug logging.
   * @returns {Array<AnyLayer | Group>} The parsed layers.
   */
  private static layersParse(
    data: Array<JSONLayer | IGroup>,
    opts?: { debug?: boolean },
  ): Array<AnyLayer | Group> {
    return data.map((layer: any) => {
      if (opts?.debug) LazyLog.log("info", `Parsing layer ${layer.id}...\nData:`, layer);
      return JSONReader.layerParse(layer, {
        id: layer.id,
        zIndex: layer.zIndex,
        visible: layer.visible,
      });
    });
  }

  /**
   * Parses a single JSON layer into an AnyLayer or Group instance.
   * @param {JSONLayer | IGroup | Group} [layer] - The JSON layer to parse.
   * @param {IBaseLayerMisc} [misc] - Miscellaneous options for the layer.
   * @returns {AnyLayer | Group} The parsed layer.
   */
  private static layerParse(
    layer: JSONLayer | IGroup | Group,
    misc?: IBaseLayerMisc,
  ): AnyLayer | Group {
    if (layer instanceof Group) {
      return new Group(layer.props, misc).add(
        ...(layer.layers.map((l: any) =>
          JSONReader.layerParse(l, { id: l.id, zIndex: l.zIndex, visible: l.visible }),
        ) as AnyLayer[]),
      );
    }
    switch (layer.type) {
      case LayerType.BezierCurve:
        return new Bezier(layer.props as IBezierProps, misc).setColor(JSONReader.fillParse(layer));
      case LayerType.QuadraticCurve:
        return new Quadratic(layer.props as IQuadraticProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Image:
        return new Image(layer.props as IImageProps, misc);
      case LayerType.Text:
        return new Text(layer.props as ITextProps, misc).setColor(JSONReader.fillParse(layer));
      case LayerType.Morph:
        return new Morph(layer.props as IMorphProps, misc).setColor(JSONReader.fillParse(layer));
      case LayerType.Line:
        return new Line(layer.props as ILineProps, misc).setColor(JSONReader.fillParse(layer));
      case LayerType.Path:
        return new Path2D(layer.props as IPath2DProps, misc).setColor(JSONReader.fillParse(layer));
      case LayerType.Polygon:
        return new Polygon(layer.props as IPolygonProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Group:
        return new Group((layer as unknown as IGroup).props, misc).add(
          ...((layer as unknown as IGroup).layers ?? []).map((l: any) =>
            JSONReader.layerParse(l, { id: l.id, zIndex: l.zIndex, visible: l.visible }),
          ),
        );
      default:
        return layer as AnyLayer;
    }
  }

  /**
   * Parses the fill style of a layer.
   * @param {JSONLayer} [layer] - The layer whose fill style is to be parsed.
   * @returns {string | Gradient | Pattern} The parsed fill style.
   */
  private static fillParse(layer: JSONLayer): string | Gradient | Pattern {
    if ("color" in layer.props) {
      if (isSignal<string>(layer.props.color)) {
        throw new LazyError("Signals are not supported in JSON fill styles");
      }
      if (typeof layer.props.color === "object") {
        switch (layer.props.color?.fillType) {
          case "gradient":
            return new Gradient({ props: layer.props.color as IGradient });
          case "pattern":
            return new Pattern()
              .setType((layer.props.color as IPattern).type)
              .setSrc(
                typeof (layer.props.color as IPattern).src === "string"
                  ? (layer.props.color as IPattern).src
                  : JSONReader.read((layer.props.color as IPattern).src as unknown as IOLazyCanvas),
              );
          default:
            return layer.props.color;
        }
      }
      return layer.props.color || "#000000";
    }
    return "#000000";
  }
}

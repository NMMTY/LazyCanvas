import { Gradient, type IGradient, type IPattern, Pattern } from "../";
import { isSignal } from "../../../core";
import { type AnyLayer, type ICanvasAdapter, type JSONLayer, LayerType } from "../../../types";
import { LazyError, LazyLog } from "../../../utils";
import { type IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import {
  BezierLayer,
  Div,
  type IBaseLayerMisc,
  type IBezierLayerProps,
  type IDiv,
  type IImageLayerProps,
  type ILineLayerProps,
  type IMorphLayerProps,
  type IPath2DLayerProps,
  type IPolygonLayerProps,
  type IQuadraticLayerProps,
  type ITextLayerProps,
  ImageLayer,
  LineLayer,
  MorphLayer,
  Path2DLayer,
  PolygonLayer,
  QuadraticLayer,
  TextLayer,
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
      return JSONReader.layerParse(layer, {
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
      return new Div(layer.props, misc).add(
        ...(layer.layers.map((l: any) =>
          JSONReader.layerParse(l, { id: l.id, zIndex: l.zIndex, visible: l.visible }),
        ) as AnyLayer[]),
      );
    }
    switch (layer.type) {
      case LayerType.BezierCurve:
        return new BezierLayer(layer.props as IBezierLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.QuadraticCurve:
        return new QuadraticLayer(layer.props as IQuadraticLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Image:
        return new ImageLayer(layer.props as IImageLayerProps, misc);
      case LayerType.Text:
        return new TextLayer(layer.props as ITextLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Morph:
        return new MorphLayer(layer.props as IMorphLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Line:
        return new LineLayer(layer.props as ILineLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Path:
        return new Path2DLayer(layer.props as IPath2DLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Polygon:
        return new PolygonLayer(layer.props as IPolygonLayerProps, misc).setColor(
          JSONReader.fillParse(layer),
        );
      case LayerType.Group:
        return new Div((layer as unknown as IDiv).props, misc).add(
          ...((layer as unknown as IDiv).layers ?? []).map((l: any) =>
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

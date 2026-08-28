import { JSONReader } from "./JSONReader";
import * as _yaml from "js-yaml";
import { IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import { ICanvasAdapter } from "../../../types";
import { LazyError, LazyLog } from "../../../utils";

export class YAMLReader {
  /**
   * Reads a YAML string and converts it to a LazyCanvas object.
   * @param {string} [data] - The YAML string to read.
   * @param {Object} [opts] - Optional parameters for debugging.
   * @returns A Promise that resolves to a LazyCanvas object.
   */
  public static read(
    data: string,
    opts?: { debug?: boolean; adapter?: ICanvasAdapter },
  ): LazyCanvas {
    const yamlContent = _yaml.load(data) as unknown as IOLazyCanvas;
    if (opts?.debug) {
      LazyLog.log("info", "YAML content loaded:", yamlContent);
    }
    if (typeof yamlContent === "object" && yamlContent !== null) {
      return JSONReader.read(yamlContent, opts);
    } else {
      throw new LazyError("Invalid YAML content: Expected an object.");
    }
  }
}

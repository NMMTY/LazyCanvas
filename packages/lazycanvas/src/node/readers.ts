import * as fs from "node:fs";
import * as path from "node:path";
import { JSONReader, YAMLReader } from "../structures/helpers";
import { IOLazyCanvas, LazyCanvas } from "../structures/LazyCanvas";
import { ICanvasAdapter } from "../types";
import { LazyError, LazyLog } from "../utils";

/**
 * Options accepted by the file readers.
 */
export interface IReadFileOptions {
  /** Whether debug logging is enabled. */
  debug?: boolean;
  /** The canvas adapter the resulting LazyCanvas should use. */
  adapter?: ICanvasAdapter;
}

/**
 * Reads a JSON file from disk and converts it into a LazyCanvas instance.
 *
 * @param {string} [file] - Path to the `.json` file.
 * @param {IReadFileOptions} [opts] - Reader options.
 * @returns {LazyCanvas} The created LazyCanvas instance.
 * @throws {LazyError} If the file does not exist.
 */
export function readJSONFile(file: string, opts?: IReadFileOptions): LazyCanvas {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) throw new LazyError(`File not found: ${filePath}`);

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as IOLazyCanvas;
  if (opts?.debug) LazyLog.log("info", "Reading JSON file...\nFile:", filePath, "\nData:", data);

  return JSONReader.read(data, opts);
}

/**
 * Reads a YAML file from disk and converts it into a LazyCanvas instance.
 *
 * @param {string} [file] - Path to the `.yaml` / `.yml` file.
 * @param {IReadFileOptions} [opts] - Reader options.
 * @returns {LazyCanvas} The created LazyCanvas instance.
 * @throws {LazyError} If the file does not exist or has an unexpected extension.
 */
export function readYAMLFile(file: string, opts?: IReadFileOptions): LazyCanvas {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) throw new LazyError(`File not found: ${filePath}`);

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".yaml" && ext !== ".yml") {
    throw new LazyError(`Invalid file extension: ${ext}. Expected .yaml or .yml.`);
  }

  if (opts?.debug) LazyLog.log("info", `Reading YAML file: ${filePath}`);

  return YAMLReader.read(fs.readFileSync(filePath, "utf8"), opts);
}

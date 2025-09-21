import { JSONReader } from "./JSONReader";
import * as _yaml from 'js-yaml';
import { IOLazyCanvas, LazyCanvas } from "../../LazyCanvas";
import * as fs from "fs";
import { LazyError, LazyLog } from "../../../utils/LazyUtil";
import * as path from "path";

export class YAMLReader {

    /**
     * Reads a YAML string and converts it to a LazyCanvas object.
     * @param {string} [data] - The YAML string to read.
     * @param {Object} [opts] - Optional parameters for debugging.
     * @returns A Promise that resolves to a LazyCanvas object.
     */
    public static read(data: string, opts?: { debug?: boolean }): LazyCanvas {
        const yamlContent = _yaml.load(data) as unknown as IOLazyCanvas
        if (opts?.debug) {
            LazyLog.log('info', 'YAML content loaded:', yamlContent);
        }
        if (typeof yamlContent === 'object' && yamlContent !== null) {
            return JSONReader.read(yamlContent, opts);
        } else {
            throw new LazyError("Invalid YAML content: Expected an object.");
        }
    }

    /**
     * Reads a YAML file and converts it to a LazyCanvas object.
     * @param {string} [filePath] - The path to the YAML file.
     * @param {Object} [opts] - Optional parameters for debugging.
     * @returns A Promise that resolves to a LazyCanvas object.
     * @throws LazyError if the file does not exist or has an invalid extension.
     */
    public static readFile(filePath: string, opts?: { debug?: boolean }): LazyCanvas {
        if (!fs.existsSync(filePath)) {
            throw new LazyError(`File not found: ${filePath}`);
        }
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.yaml' && ext !== '.yml') {
            throw new LazyError(`Invalid file extension: ${ext}. Expected .yaml or .yml.`);
        }
        const data = fs.readFileSync(filePath, 'utf8');
        if (opts?.debug) {
            LazyLog.log('info', `Reading YAML file: ${filePath}`);
        }
        return this.read(data, opts);
    }
}
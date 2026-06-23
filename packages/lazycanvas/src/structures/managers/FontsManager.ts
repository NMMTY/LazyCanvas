import { Font, IFonts } from "../helpers";
import { LazyError, LazyLog } from "../../utils/LazyUtil";
import { Fonts } from "../../helpers/Fonts";
import { ICanvasAdapter, IFontsAdapter } from "../../types";

/**
 * Interface representing the FontsManager.
 */
export interface IFontsManager {
  map: Map<string, Font>;
  debug: boolean;
}

/**
 * Class representing a manager for handling fonts.
 */
export class FontsManager implements IFontsManager {
  map: Map<string, Font>;
  debug: boolean;
  private adapter?: IFontsAdapter;

  constructor(opts?: { debug?: boolean; adapter?: ICanvasAdapter }) {
    this.map = new Map();
    this.debug = opts?.debug || false;
    this.adapter = opts?.adapter?.fonts;

    this.loadFonts(Fonts);
  }

  loadFonts(fontList: IFonts): this {
    this.add(
      ...Object.entries(fontList)
        .map(([fontFamily, fontWeights]) => {
          return Object.entries(fontWeights).map(([weight, base64]) => {
            return new Font().setFamily(fontFamily).setWeight(Number(weight)).setBase64(base64);
          });
        })
        .flat(),
    );

    return this;
  }

  public add(...fonts: Font[]): this {
    if (this.debug) LazyLog.log("info", `Adding fonts...\nlength: ${fonts.length}`);
    for (const font of fonts) {
      if (this.debug) LazyLog.log("none", `Data:`, font.toJSON());
      if (!font.family) throw new LazyError("Family must be provided");
      if (!font.weight) throw new LazyError("Weight must be provided");
      if (!font.path && !font.base64) throw new LazyError("Path or base64 must be provided");
      if (this.map.has(`${font.family}_${font.weight}`)) throw new LazyError("Font already exists");
      this.map.set(`${font.family}_${font.weight}`, font);
      if (this.adapter) {
        if (font.path) this.adapter.registerFromPath(font.path, font.family);
        if (font.base64) {
          const base64Str = typeof font.base64 === "string"
            ? font.base64
            : (font.base64 as Buffer).toString("base64");
          this.adapter.register(base64Str, font.family);
        }
      }
    }
    return this;
  }

  public remove(...array: Array<{ family: string; weight: string }>): this {
    for (const font of array) {
      this.map.delete(`${font.family}_${font.weight}`);
    }
    return this;
  }

  public clear(): this {
    this.map.clear();
    return this;
  }

  public get(family: string, weight?: string): Font | Font[] | undefined {
    if (weight) return this.map.get(`${family}_${weight}`);
    return Array.from(this.map.values()).filter((font) => font.family === family);
  }

  public has(family: string, weight?: string): boolean {
    if (weight) return this.map.has(`${family}_${weight}`);
    return Array.from(this.map.values()).some((font) => font.family === family);
  }

  public size(): number {
    return this.map.size;
  }

  public values(): IterableIterator<Font> {
    return this.map.values();
  }

  public keys(): IterableIterator<string> {
    return this.map.keys();
  }

  public entries(): IterableIterator<[string, Font]> {
    return this.map.entries();
  }

  public forEach(
    callbackfn: (value: Font, key: string, map: Map<string, Font>) => void,
    thisArg?: any,
  ): this {
    this.map.forEach(callbackfn, thisArg);
    return this;
  }

  public toJSON(): object {
    return Object.fromEntries(this.map);
  }

  public fromJSON(json: object): this {
    this.map = new Map(Object.entries(json));
    return this;
  }

  public toArray(): Font[] {
    return Array.from(this.map.values());
  }

  public fromArray(array: Font[]): this {
    for (const font of array) {
      this.map.set(`${font.family}_${font.weight}`, font);
    }
    return this;
  }
}

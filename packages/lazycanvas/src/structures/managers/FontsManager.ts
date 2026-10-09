import type { ICanvasAdapter, IFontsAdapter } from "../../types";
import { LazyError, LazyLog } from "../../utils/LazyUtil";
import { Font, type FontData, type IFonts } from "../helpers";

/**
 * Normalises font data to the base64 string that adapters register.
 * Works without Node's `Buffer`, so it is safe in the browser.
 */
function toBase64(data: FontData): string {
  if (typeof data === "string") return data;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return data.toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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
  }

  /**
   * Registers every family/weight of a font list.
   *
   * The bundled Geist families are no longer loaded automatically — they are
   * ~2.7 MB of base64 data that most projects never use. Opt in explicitly:
   *
   * ```ts
   * import { Fonts } from "@nmmty/lazycanvas/fonts";
   *
   * canvas.manager.fonts.loadFonts(Fonts);
   * ```
   *
   * @param {IFonts} [fontList] - Families mapped to weight/base64 pairs.
   * @returns {this} The current instance for chaining.
   */
  loadFonts(fontList: IFonts): this {
    this.add(
      ...Object.entries(fontList).flatMap(([fontFamily, fontWeights]) => {
        return Object.entries(fontWeights).map(([weight, base64]) => {
          return new Font().setFamily(fontFamily).setWeight(Number(weight)).setBase64(base64);
        });
      }),
    );

    return this;
  }

  /**
   * Registers fonts and, when an adapter is present, hands them to it.
   *
   * @param {...Font} fonts - The fonts to add.
   * @returns {this} The current instance for chaining.
   * @throws {LazyError} If a font has no family, weight or source, or is already registered.
   */
  public add(...fonts: Font[]): this {
    if (this.debug) LazyLog.log("info", `Adding fonts...\nlength: ${fonts.length}`);
    for (const font of fonts) {
      if (this.debug) LazyLog.log("none", "Data:", font.toJSON());
      if (!font.family) throw new LazyError("Family must be provided");
      if (!font.weight) throw new LazyError("Weight must be provided");
      if (!font.path && !font.base64) throw new LazyError("Path or base64 must be provided");
      if (this.map.has(`${font.family}_${font.weight}`)) throw new LazyError("Font already exists");
      this.map.set(`${font.family}_${font.weight}`, font);
      if (this.adapter) {
        if (font.path) this.adapter.registerFromPath(font.path, font.family);
        if (font.base64) {
          this.adapter.register(toBase64(font.base64), font.family);
        }
      }
    }
    return this;
  }

  /**
   * Forgets fonts. The underlying adapter keeps any font it already registered.
   *
   * @param {...{ family: string; weight: string }} array - The fonts to remove.
   * @returns {this} The current instance for chaining.
   */
  public remove(...array: Array<{ family: string; weight: string }>): this {
    for (const font of array) {
      this.map.delete(`${font.family}_${font.weight}`);
    }
    return this;
  }

  /**
   * Forgets every font.
   *
   * @returns {this} The current instance for chaining.
   */
  public clear(): this {
    this.map.clear();
    return this;
  }

  /**
   * Looks fonts up.
   *
   * @param {string} family - The font family.
   * @param {string} [weight] - A weight; without it every font of the family is returned.
   * @returns {Font | Font[] | undefined} A single font when a weight is given, otherwise an array.
   */
  public get(family: string, weight?: string): Font | Font[] | undefined {
    if (weight) return this.map.get(`${family}_${weight}`);
    return Array.from(this.map.values()).filter((font) => font.family === family);
  }

  /** Whether a family (optionally at a given weight) is registered. */
  public has(family: string, weight?: string): boolean {
    if (weight) return this.map.has(`${family}_${weight}`);
    return Array.from(this.map.values()).some((font) => font.family === family);
  }

  /** The number of registered fonts. */
  public size(): number {
    return this.map.size;
  }

  /** Iterates over the registered fonts. */
  public values(): IterableIterator<Font> {
    return this.map.values();
  }

  /** Iterates over the `family_weight` keys. */
  public keys(): IterableIterator<string> {
    return this.map.keys();
  }

  /** Iterates over `[key, font]` pairs. */
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

  /** Serialises the registered fonts. */
  public toJSON(): object {
    return Object.fromEntries(this.map);
  }

  /** Replaces the registered fonts with serialised ones. */
  public fromJSON(json: object): this {
    this.map = new Map(Object.entries(json));
    return this;
  }

  /** The registered fonts as an array. */
  public toArray(): Font[] {
    return Array.from(this.map.values());
  }

  /** Replaces the registered fonts with the given array. */
  public fromArray(array: Font[]): this {
    for (const font of array) {
      this.map.set(`${font.family}_${font.weight}`, font);
    }
    return this;
  }
}

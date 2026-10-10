import { Signal, unwrap } from "../../core/Signal";
import type { AnyLayer, ICanvas, ICanvasAdapter, ICanvasRenderingContext2D } from "../../types";
import { LayerType } from "../../types";
import { getChildren } from "../../utils/tree";
import type { Group } from "../components/Group";
import { Link } from "../helpers/Link";
import type { LayersManager } from "./LayersManager";

/** Options of the layer cache. */
export interface LayerCacheOptions {
  /**
   * Which layers are stored.
   *
   * - `"auto"` (default): layers that have a `filter` (a blur costs far more than the copy that
   *   replaces it), plus every layer that sets `cache: true`.
   * - `"explicit"`: only layers that set `cache: true`.
   *
   * A layer that sets `cache: false` is never stored.
   */
  mode?: "auto" | "explicit";

  /** Upper bound for the pixels held by the cache, in bytes (default 64 MiB). */
  maxBytes?: number;

  /** Upper bound for the number of stored layers (default 64). */
  maxEntries?: number;
}

/** Counters of a {@link LayerCache}. */
export interface LayerCacheStats {
  /** Layers drawn by copying a stored picture of themselves. */
  hits: number;
  /** Layers rebuilt from a stored shape mask, only painted with a new colour. */
  tinted: number;
  /** Layers that had to be drawn for real and were stored. */
  misses: number;
  /** Layers that asked to be stored but could not be (see {@link LayerCache} for what rules a layer out). */
  bypassed: number;
  /** Pictures dropped to stay inside the limits. */
  evictions: number;
  /** Pictures held right now (shape masks included). */
  entries: number;
  /** Pixel memory held right now, in bytes. */
  bytes: number;
}

interface Entry {
  surface: ICanvas;
  bytes: number;
}

interface Plan {
  full: string;
  mask: string | null;
  color: unknown;
  matrix: number[];
}

/** Thrown while building a key when a value has no stable description. */
class Uncacheable extends Error {}

/** Props that change nothing about the pixels of a layer on their own. */
const NOT_VISUAL = new Set(["layout", "id", "visible", "zIndex", "cache", "children"]);

/** Layers whose whole output is one flat colour times a coverage mask. */
const FLAT_FILL = new Set<string>([
  LayerType.Morph,
  LayerType.Path,
  LayerType.Polygon,
  LayerType.Line,
  LayerType.BezierCurve,
  LayerType.QuadraticCurve,
]);

/** `blur(12px)` and nothing else: the only filter that commutes with painting in another colour. */
const PLAIN_BLUR = /^\s*blur\(\s*[\d.]+(px)?\s*\)\s*$/;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Describes a value so that equal descriptions mean equal pictures.
 * Throws {@link Uncacheable} for anything that has no such description.
 */
function describe(value: unknown, skip?: ReadonlySet<string>, depth = 0): string {
  if (depth > 12) throw new Uncacheable();
  if (value === undefined) return "u";
  if (value === null) return "n";
  switch (typeof value) {
    case "number":
      return Number.isFinite(value) ? String(round(value)) : `#${value}`;
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "T" : "F";
    case "object":
      break;
    default:
      // functions, symbols, bigints
      throw new Uncacheable();
  }

  if (value instanceof Signal) return describe(unwrap(value), undefined, depth + 1);
  // A link points at another layer, whose geometry can change without this layer changing.
  if (value instanceof Link) throw new Uncacheable();
  if (Array.isArray(value)) {
    return `[${value.map((item) => describe(item, undefined, depth + 1)).join(",")}]`;
  }

  // Binary data (a Buffer has a toJSON, which would spell out every byte) has no cheap description.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) throw new Uncacheable();

  const withJSON = value as { toJSON?: () => unknown };
  if (typeof withJSON.toJSON === "function") {
    return describe(withJSON.toJSON(), undefined, depth + 1);
  }

  // Buffers, typed arrays, Path2D and other class instances have no stable description.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Uncacheable();

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    if (skip?.has(key)) continue;
    parts.push(`${key}:${describe(record[key], undefined, depth + 1)}`);
  }
  return `{${parts.join(",")}}`;
}

/** What a layer looks like to the cache: its type and every prop that reaches the pixels. */
function describeLayer(layer: AnyLayer | Group, without?: ReadonlySet<string>): string {
  const skip = without ? new Set([...NOT_VISUAL, ...without]) : NOT_VISUAL;
  let text = `${layer.type}${describe(layer.props ?? {}, skip)}`;

  // A group draws its children, so its picture depends on every one of them.
  const children = getChildren(layer);
  if (layer.type === LayerType.Group) {
    text += `<${children.map((c) => `${c.visible ? 1 : 0}${describeLayer(c)}`).join(";")}>`;
  }
  return text;
}

/**
 * Keeps the picture of layers between frames so that a layer which has not changed is copied
 * instead of drawn again.
 *
 * A layer is looked up by *what it looks like*, not by its identity: its type, its props after
 * layout, the size of the canvas and the current transform. Layer objects can be created anew for
 * every frame (a React tree does that) and still find their picture from the frame before.
 *
 * Two kinds of pictures are stored:
 *
 * - **the layer itself**, found again when every one of those values is the same;
 * - **the shape mask** of a layer filled with one flat colour and blurred: its blurred outline,
 *   without the colour. When only the colour differs from every stored layer, the mask is painted
 *   in the new colour (`source-in`) instead of being blurred again, which is the part that costs.
 *
 * What is never stored: layers with a `Link`, a function, a `Buffer` or any other value that has
 * no stable description; layers with `clipPath`; and, without `cache: true`, layers without a `filter`.
 *
 * Only worth it for a scene that is drawn many times. A scene that is drawn once pays for every
 * stored picture and never reads it, so the cache is off unless asked for.
 */
export class LayerCache {
  private readonly entries = new Map<string, Entry>();
  private readonly colors = new Map<string, [number, number, number, number]>();
  /** Shape mask key -> key of the one painted picture kept for it. */
  private readonly paintedOf = new Map<string, string>();
  private readonly adapter: ICanvasAdapter;
  private readonly mode: "auto" | "explicit";
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private bytes = 0;
  private counters = { hits: 0, tinted: 0, misses: 0, bypassed: 0, evictions: 0 };

  constructor(adapter: ICanvasAdapter, opts: LayerCacheOptions = {}) {
    this.adapter = adapter;
    this.mode = opts.mode ?? "auto";
    this.maxBytes = opts.maxBytes ?? 64 * 1024 * 1024;
    this.maxEntries = opts.maxEntries ?? 64;
  }

  /** The counters, for tuning and for tests. */
  get stats(): LayerCacheStats {
    return { ...this.counters, entries: this.entries.size, bytes: this.bytes };
  }

  /** Drops every stored picture, e.g. because the canvas was resized. */
  clear(): void {
    this.entries.clear();
    this.paintedOf.clear();
    this.bytes = 0;
  }

  /**
   * Draws a layer through the cache.
   *
   * @returns {Promise<boolean>} `false` if the layer is not eligible; nothing was drawn then and
   * the caller must draw it itself.
   */
  async draw(
    layer: AnyLayer | Group,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter?: ICanvasAdapter,
  ): Promise<boolean> {
    const plan = this.plan(layer, ctx, canvas);
    if (plan === "unwanted") return false;
    if (plan === "unstorable") {
      this.counters.bypassed++;
      return false;
    }

    const composite = layer.props?.globalComposite || "source-over";
    const render = (overrides: Record<string, unknown>) =>
      this.render(layer, plan.matrix, canvas, manager, debug, adapter, overrides);

    const whole = this.get(plan.full);
    if (whole) {
      this.counters.hits++;
      this.blit(ctx, whole.surface, composite);
      return true;
    }

    let surface: ICanvas;
    if (plan.mask !== null) {
      let mask = this.get(plan.mask);
      if (mask) {
        this.counters.tinted++;
      } else {
        // The shape in an opaque colour: the colour is applied below, whichever it is.
        mask = this.put(plan.mask, await render({ color: "#000000" }));
        this.counters.misses++;
      }
      surface = this.tint(mask.surface, plan.color as string, canvas);
      // Repainting costs a copy, so only the last colour of a shape is worth its memory: while a
      // colour is being dragged, every step would otherwise push something useful out.
      const previous = this.paintedOf.get(plan.mask);
      if (previous !== undefined && previous !== plan.full) this.drop(previous);
      this.paintedOf.set(plan.mask, plan.full);
    } else {
      surface = await render({});
      this.counters.misses++;
    }
    this.put(plan.full, surface);

    this.blit(ctx, surface, composite);
    return true;
  }

  /** Decides whether a layer is stored and under which keys. */
  private plan(
    layer: AnyLayer | Group,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
  ): Plan | "unwanted" | "unstorable" {
    const props = (layer.props ?? {}) as Record<string, unknown>;
    if (props.cache === false) return "unwanted";
    const wanted =
      props.cache === true ||
      (this.mode === "auto" && typeof props.filter === "string" && props.filter !== "");
    if (!wanted) return "unwanted";
    if (props.clipPath) return "unstorable";
    if (layer.type === LayerType.Image && typeof props.src !== "string") return "unstorable";

    const reader = ctx as {
      getTransform?: () => { a: number; b: number; c: number; d: number; e: number; f: number };
    };
    if (typeof reader.getTransform !== "function") return "unstorable";
    if (canvas.width * canvas.height * 4 > this.maxBytes) return "unstorable";

    const t = reader.getTransform();
    const matrix = [t.a, t.b, t.c, t.d, t.e, t.f];
    const where = `${canvas.width}x${canvas.height}@${matrix.map(round).join(",")}`;

    try {
      const tintable =
        FLAT_FILL.has(layer.type) &&
        typeof props.color === "string" &&
        !props.shadow &&
        (props.filter === undefined || PLAIN_BLUR.test(String(props.filter)));

      if (tintable) {
        const shape = describeLayer(layer, new Set(["color"]));
        return {
          full: `${where}|${shape}|${props.color}`,
          mask: `mask|${where}|${shape}`,
          color: props.color,
          matrix,
        };
      }
      return { full: `${where}|${describeLayer(layer)}`, mask: null, color: undefined, matrix };
    } catch (error) {
      if (error instanceof Uncacheable) return "unstorable";
      throw error;
    }
  }

  /** Looks a picture up and marks it as the most recently used. */
  private get(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }

  private drop(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.bytes -= entry.bytes;
  }

  private put(key: string, surface: ICanvas): Entry {
    const entry = { surface, bytes: surface.width * surface.height * 4 };
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    // A Map iterates in insertion order, so the first key is the least recently used.
    while (
      (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) &&
      this.entries.size > 1
    ) {
      const oldest = this.entries.keys().next().value as string;
      const dropped = this.entries.get(oldest) as Entry;
      this.entries.delete(oldest);
      this.bytes -= dropped.bytes;
      this.counters.evictions++;
    }
    return entry;
  }

  /** Draws the layer on a transparent surface of its own, in the place it has on the canvas. */
  private async render(
    layer: AnyLayer | Group,
    matrix: number[],
    canvas: ICanvas,
    manager: LayersManager,
    debug: boolean,
    adapter: ICanvasAdapter | undefined,
    overrides: Record<string, unknown>,
  ): Promise<ICanvas> {
    const surface = this.adapter.createCanvas(canvas.width, canvas.height);
    const sctx = surface.getContext("2d") as ICanvasRenderingContext2D & {
      setTransform: (...m: number[]) => void;
    };
    sctx.setTransform(...matrix);

    // The surface is empty, so a blend mode that depends on what is underneath (source-atop)
    // would draw nothing here. The layer is drawn plainly and blended when it is copied.
    const props = layer.props as Record<string, unknown>;
    const patched: Record<string, unknown> = { globalComposite: undefined, ...overrides };
    const saved: Record<string, { had: boolean; value: unknown }> = {};
    for (const key of Object.keys(patched)) {
      saved[key] = { had: key in props, value: props[key] };
      props[key] = patched[key];
    }
    try {
      await layer.draw(sctx, surface, manager, debug, adapter);
    } finally {
      for (const [key, previous] of Object.entries(saved)) {
        if (previous.had) props[key] = previous.value;
        else delete props[key];
      }
    }
    return surface;
  }

  /**
   * A copy of a mask painted in `color`.
   *
   * The colour is painted opaque and its alpha is applied when the result is copied. Painting a
   * translucent colour with `source-in` is where canvas implementations disagree: some multiply
   * the alpha in twice.
   */
  private tint(mask: ICanvas, color: string, canvas: ICanvas): ICanvas {
    const [r, g, b, a] = this.resolveColor(color);
    const painted = this.adapter.createCanvas(canvas.width, canvas.height);
    const pctx = painted.getContext("2d");
    pctx.drawImage(mask, 0, 0);
    pctx.globalCompositeOperation = "source-in";
    pctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    pctx.fillRect(0, 0, canvas.width, canvas.height);
    if (a >= 255) return painted;

    const faded = this.adapter.createCanvas(canvas.width, canvas.height);
    const fctx = faded.getContext("2d");
    fctx.globalAlpha = a / 255;
    fctx.drawImage(painted, 0, 0);
    return faded;
  }

  /**
   * Any CSS colour as `[r, g, b, a]`, as the canvas itself reads it (hex, `rgb()`, `hsl()`, names,
   * 8-digit hex). Asking the canvas means there is no colour parser to keep in step with it.
   */
  private resolveColor(color: string): [number, number, number, number] {
    const known = this.colors.get(color);
    if (known) return known;
    const probe = this.adapter.createCanvas(1, 1);
    const pctx = probe.getContext("2d");
    pctx.fillStyle = color;
    pctx.fillRect(0, 0, 1, 1);
    const { data } = pctx.getImageData(0, 0, 1, 1);
    const rgba: [number, number, number, number] = [data[0], data[1], data[2], data[3]];
    if (this.colors.size > 256) this.colors.clear();
    this.colors.set(color, rgba);
    return rgba;
  }

  /** Copies a stored picture onto the canvas, in the layer's own blend mode. */
  private blit(ctx: ICanvasRenderingContext2D, surface: ICanvas, composite: string): void {
    const c = ctx as ICanvasRenderingContext2D & { setTransform: (...m: number[]) => void };
    ctx.save();
    try {
      c.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      ctx.filter = "none";
      ctx.globalCompositeOperation = composite;
      ctx.drawImage(surface, 0, 0);
    } finally {
      ctx.restore();
    }
  }
}

/**
 * Draws one layer, through the cache of the canvas when it has one and the layer is eligible.
 * Every place that draws a layer goes through here.
 */
export async function drawLayerCached(
  layer: AnyLayer | Group,
  ctx: ICanvasRenderingContext2D,
  canvas: ICanvas,
  manager: LayersManager,
  debug: boolean,
  adapter?: ICanvasAdapter,
): Promise<void> {
  if (manager.cache && (await manager.cache.draw(layer, ctx, canvas, manager, debug, adapter))) {
    return;
  }
  await layer.draw(ctx, canvas, manager, debug, adapter);
}

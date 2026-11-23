import { Signal } from "../../core/Signal";
import type { AnyLayer, ICanvas, ICanvasAdapter, ICanvasRenderingContext2D } from "../../types";
import { type Later, isLater } from "../../utils/LazyUtil";
import { getChildren } from "../../utils/tree";
import type { Group } from "../components/Group";
import { Link } from "../helpers/Link";

/** Options of the baker. */
export interface BakeOptions {
  /**
   * How many frames in a row a run of layers has to look the same before it is worth looking at (default 2).
   * A scene drawn once, or a layer that changes every frame, never pays for a picture.
   */
  minStable?: number;

  /**
   * A run is baked only if drawing it takes at least this long, in milliseconds (default 0.5), measured once
   * with the canvas flushed, and if copying the picture is clearly cheaper than that.
   */
  minMs?: number;

  /**
   * Bake every run that was the same for `minStable` frames, without finding out first whether it pays (default
   * `false`). For a canvas whose drawing cannot be timed this way, and for tests.
   */
  always?: boolean;

  /** Upper bound for the pixels held, in bytes (default 128 MiB). */
  maxBytes?: number;

  /** Upper bound for the number of pictures held (default 16). */
  maxEntries?: number;
}

/** Counters of a {@link Baker}. */
export interface BakeStats {
  /** Runs drawn by copying their picture. */
  blits: number;
  /** Pictures built. */
  bakes: number;
  /** Runs that were looked at and not worth a picture (cheap to draw, or no cheaper to copy). */
  rejected: number;
  /** Pictures dropped to stay inside the limits. */
  evictions: number;
  /** Pictures held right now. */
  entries: number;
  /** Pixel memory held right now, in bytes. */
  bytes: number;
}

/** Neighbouring layers that did not change, drawn as one. */
export interface BakedRun {
  layers: Array<AnyLayer | Group>;
  h1: number;
  h2: number;
}

/** What a run has been through. */
interface Entry {
  h2: number;
  /** In how many frames in a row it was the same. */
  seen: number;
  lastFrame: number;
  /** Looked at and not worth it: drawn the ordinary way for as long as it stays the same. */
  rejected: boolean;
  surface?: ICanvas;
  bytes: number;
}

/** The mode a run is painted in: onto the canvas as the frame goes, or onto a picture of its own. */
export type RunPainter = (
  ctx: ICanvasRenderingContext2D,
  canvas: ICanvas,
  baking: boolean,
) => Later;

// What a layer looks like, as two 32-bit hashes. No strings are built: it is done for every layer of every
// frame, and the point is to spend less than drawing them would.
let h1 = 0;
let h2 = 0;
const SEED_1 = 0x2545f491;
const SEED_2 = 0x4cf5ad43;
const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

function mix(n: number): void {
  h1 = Math.imul(h1 ^ n, 2654435761);
  h1 ^= h1 >>> 15;
  h2 = Math.imul(h2 ^ n, 1597334677);
  h2 ^= h2 >>> 13;
}

function hashString(value: string): void {
  const length = value.length;
  mix(length);
  // A long string (the path of a drawing, an image inlined as text) is read at both ends and not in the middle.
  if (length <= 256) {
    for (let i = 0; i < length; i++) mix(value.charCodeAt(i));
    return;
  }
  for (let i = 0; i < 128; i++) mix(value.charCodeAt(i));
  for (let i = length - 128; i < length; i++) mix(value.charCodeAt(i));
}

/** Props that change nothing about the pixels of a layer on their own. */
const NOT_VISUAL = new Set(["layout", "id", "visible", "zIndex", "cache", "bake", "children"]);

/** Hashes a value; `false` if it has no stable description (so the layer it is in is not baked). */
function hashValue(value: unknown, depth: number): boolean {
  if (depth > 12) return false;
  switch (typeof value) {
    case "number":
      mix(1);
      if ((value | 0) === value) {
        mix(value);
      } else {
        f64[0] = value;
        mix(u32[0]);
        mix(u32[1]);
      }
      return true;
    case "string":
      mix(2);
      hashString(value);
      return true;
    case "boolean":
      mix(value ? 3 : 4);
      return true;
    case "undefined":
      mix(5);
      return true;
    case "object":
      break;
    default:
      return false;
  }

  if (value === null) {
    mix(6);
    return true;
  }
  // A signal that is still in the props is read by whoever uses it; a link points at another layer, whose place
  // can change without this layer changing.
  if (value instanceof Signal || value instanceof Link) return false;

  if (Array.isArray(value)) {
    mix(7);
    mix(value.length);
    for (let i = 0; i < value.length; i++) if (!hashValue(value[i], depth + 1)) return false;
    return true;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false;

  const withJSON = value as { toJSON?: () => unknown };
  if (typeof withJSON.toJSON === "function") return hashValue(withJSON.toJSON(), depth + 1);

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;

  mix(8);
  const record = value as Record<string, unknown>;
  for (const key in record) {
    hashString(key);
    if (!hashValue(record[key], depth + 1)) return false;
  }
  return true;
}

/**
 * Hashes a layer and what it holds. `false` if it cannot be baked: a blend mode that reads what is under the
 * layer would read an empty picture, a clip reaches the layers after it, and a layer that asks not to.
 */
function hashLayer(layer: AnyLayer | Group): boolean {
  const props = (layer.props ?? {}) as Record<string, unknown>;
  if (props.bake === false || props.clipPath) return false;
  const composite = props.globalComposite;
  if (composite !== undefined && composite !== "source-over") return false;

  hashString(layer.type);
  for (const key in props) {
    if (NOT_VISUAL.has(key)) continue;
    hashString(key);
    if (!hashValue(props[key], 0)) return false;
  }

  const children = getChildren(layer);
  mix(children.length);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    mix(child.visible ? 1 : 0);
    if (child.visible && !hashLayer(child)) return false;
  }
  return true;
}

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

/**
 * Draws the layers that stay the same from one frame to the next as one picture.
 *
 * What a template is made of: a background, cards, labels that never move, and a few things on top that do. The
 * layers that did not change are drawn the ordinary way for a frame or two, and then once onto a picture of
 * their own, which is copied from then on. A canvas that draws lazily (every one the adapters wrap) pays for
 * every shadow, blur and line of text when the frame is read, so copying a picture instead is where the time goes.
 *
 * Neighbouring layers that did not change are taken together, so one picture covers them all, however many.
 * Whether they did is read from what they look like (their props after layout and animation, and the
 * transform they are drawn under), not from whether they were touched, so changing a layer in place is seen.
 * A layer that is animated at the moment simply does not belong to a run, and the ones around it do.
 *
 * Not baked: layers with a blend mode other than `source-over`, `clipPath` layers, layers holding a link or
 * binary data, layers with `bake: false`, and anything the layer cannot describe. What a layer shows without
 * its props saying so (a font that is registered later) is not seen; the baker is cleared when fonts are added.
 *
 * Each run is looked at once: drawn with the canvas flushed on both sides to see what it costs, then baked
 * only if that is worth more than copying the picture. Copying a picture is a full-canvas draw, so a handful
 * of cheap layers is better drawn than copied, and is left alone.
 *
 * Baked pixels can differ from drawn ones by a rounding step where translucent layers overlap, since
 * the layers are blended with each other before they are blended with what is below.
 */
export class Baker {
  private readonly entries = new Map<number, Entry>();
  private readonly adapter: ICanvasAdapter;
  private readonly minStable: number;
  private readonly minMs: number;
  private readonly always: boolean;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private bytes = 0;
  private frame = 0;
  /** Greater than zero while a picture is being drawn: what is inside is not baked again. */
  private baking = 0;
  private scratch?: ICanvas;
  /** What each layer looked like when it was last seen. */
  private readonly last = new WeakMap<object, [number, number]>();
  private counters = { blits: 0, bakes: 0, rejected: 0, evictions: 0 };

  constructor(adapter: ICanvasAdapter, opts: BakeOptions = {}) {
    this.adapter = adapter;
    this.minStable = opts.minStable ?? 2;
    this.minMs = opts.minMs ?? 0.5;
    this.always = opts.always ?? false;
    this.maxBytes = opts.maxBytes ?? 128 * 1024 * 1024;
    this.maxEntries = opts.maxEntries ?? 16;
  }

  get stats(): BakeStats {
    let entries = 0;
    for (const entry of this.entries.values()) if (entry.surface) entries++;
    return { ...this.counters, entries, bytes: this.bytes };
  }

  /** Called when a frame starts: runs are told apart from one frame to the next by it. */
  beginFrame(): void {
    this.frame++;
  }

  /** Drops every picture (the canvas was resized, a font was added). */
  clear(): void {
    this.entries.clear();
    this.scratch = undefined;
    this.bytes = 0;
  }

  /**
   * Splits a list of neighbours into the layers to draw and the runs of unchanged ones.
   *
   * @returns {Array | null} The list with runs in it, or `null` if there is nothing to bake.
   */
  units(
    layers: readonly (AnyLayer | Group)[],
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
  ): Array<AnyLayer | Group | BakedRun> | null {
    if (this.baking > 0 || layers.length === 0) return null;
    const reader = ctx as { getTransform?: () => Matrix };
    if (typeof reader.getTransform !== "function") return null;
    if (canvas.width * canvas.height * 4 > this.maxBytes) return null;

    const out: Array<AnyLayer | Group | BakedRun> = [];
    let runs = 0;
    let run: Array<AnyLayer | Group> = [];
    let matrix: Matrix | undefined;
    // The hashes of the run so far (the module ones belong to the layer being looked at).
    let r1 = SEED_1;
    let r2 = SEED_2;

    const close = (): void => {
      if (run.length === 0) return;
      matrix ??= reader.getTransform?.() as Matrix;
      h1 = r1;
      h2 = r2;
      mix(canvas.width);
      mix(canvas.height);
      for (const n of [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]) {
        f64[0] = n;
        mix(u32[0]);
        mix(u32[1]);
      }
      mix(run.length);
      out.push({ layers: run, h1, h2 });
      runs++;
      run = [];
      r1 = SEED_1;
      r2 = SEED_2;
    };

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.visible) continue;
      h1 = SEED_1;
      h2 = SEED_2;
      const hashable = hashLayer(layer);
      // A layer that is not the same as it was in the last frame is being animated (or edited): it is drawn
      // as it is, and the run it was in ends. Every other layer is part of a run.
      let steady = false;
      if (hashable) {
        const before = this.last.get(layer);
        steady = before !== undefined && before[0] === h1 && before[1] === h2;
        if (before) {
          before[0] = h1;
          before[1] = h2;
        } else {
          this.last.set(layer, [h1, h2]);
        }
      }
      if (steady) {
        run.push(layer);
        const l1 = h1;
        const l2 = h2;
        h1 = r1;
        h2 = r2;
        mix(l1);
        mix(l2);
        r1 = h1;
        r2 = h2;
        continue;
      }
      close();
      out.push(layer);
    }
    close();
    // A hidden layer draws nothing, so it is not in the list; without a run there is nothing to do here.
    return runs === 0 ? null : out;
  }

  /** Draws a run: the picture if there is one, otherwise the layers (and a picture, once it is worth it). */
  draw(run: BakedRun, ctx: ICanvasRenderingContext2D, canvas: ICanvas, paint: RunPainter): Later {
    const entry = this.touch(run);
    if (entry.surface) {
      this.counters.blits++;
      this.blit(ctx, entry.surface);
      return;
    }
    if (entry.rejected || entry.seen < this.minStable) return paint(ctx, canvas, false);
    return this.look(entry, ctx, canvas, paint);
  }

  /** The record of a run, counting the frames it has been the same in. */
  private touch(run: BakedRun): Entry {
    let entry = this.entries.get(run.h1);
    if (entry && entry.h2 !== run.h2) {
      this.forget(run.h1, entry);
      entry = undefined;
    }
    if (!entry) {
      entry = { h2: run.h2, seen: 0, lastFrame: -1, rejected: false, bytes: 0 };
    } else {
      // Most recently used last: a Map iterates in insertion order.
      this.entries.delete(run.h1);
    }
    this.entries.set(run.h1, entry);

    if (entry.lastFrame === this.frame - 1) entry.seen++;
    else if (entry.lastFrame !== this.frame) entry.seen = 1;
    entry.lastFrame = this.frame;

    // Runs that were seen once and never again are not worth a place; pictures are dropped by size, below.
    while (this.entries.size > this.maxEntries * 8) {
      const oldest = this.entries.keys().next().value as number;
      this.forget(oldest, this.entries.get(oldest) as Entry);
    }
    return entry;
  }

  private forget(key: number, entry: Entry): void {
    this.entries.delete(key);
    this.bytes -= entry.bytes;
  }

  /**
   * Draws the run for real and sees what it cost, then, if that is a lot, draws it onto a picture too and sees
   * whether copying that is cheaper. The canvas is flushed before and after so that the time is what the drawing
   * costs and not what it left for later.
   */
  private look(
    entry: Entry,
    ctx: ICanvasRenderingContext2D,
    canvas: ICanvas,
    paint: RunPainter,
  ): Later {
    const reject = (): void => {
      entry.rejected = true;
      this.counters.rejected++;
    };
    if (this.always) {
      const matrix = (ctx as { getTransform?: () => Matrix }).getTransform?.();
      if (!matrix) return reject();
      const baked = this.bake(entry, Number.POSITIVE_INFINITY, matrix, canvas, paint);
      // The picture is what is shown from the first frame on; if it could not be made, the layers are drawn,
      // and whatever went wrong in them is reported.
      const show = (): Later => {
        if (!entry.surface) return paint(ctx, canvas, false);
        this.counters.blits++;
        this.blit(ctx, entry.surface);
      };
      return isLater(baked) ? baked.then(show) : show();
    }
    const start = flush(ctx);
    if (start === undefined) return reject();

    let drawn: Later;
    try {
      drawn = paint(ctx, canvas, false);
    } catch (error) {
      reject();
      throw error;
    }

    const afterwards = (): Later => {
      const end = flush(ctx);
      if (end === undefined || end - start < this.minMs) return reject();
      const drawMs = end - start;
      const matrix = (ctx as { getTransform?: () => Matrix }).getTransform?.();
      if (!matrix) return reject();
      return this.bake(entry, drawMs, matrix, canvas, paint);
    };
    if (isLater(drawn)) {
      return drawn.then(afterwards, (error) => {
        reject();
        throw error;
      });
    }
    return afterwards();
  }

  /** Draws the run onto a picture and keeps it if copying it costs clearly less than drawing the run did. */
  private bake(
    entry: Entry,
    drawMs: number,
    matrix: Matrix,
    canvas: ICanvas,
    paint: RunPainter,
  ): Later {
    const surface = this.adapter.createCanvas(canvas.width, canvas.height);
    const sctx = surface.getContext("2d") as ICanvasRenderingContext2D & {
      setTransform: (...m: number[]) => void;
    };
    sctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    const keep = (): void => {
      // A lazily drawing canvas draws the picture the first time it is used as a source; that is the cost of
      // making it, not of copying it.
      if (flush(sctx) === undefined) {
        failed();
        return;
      }
      const copyMs = this.timeCopy(surface, canvas);
      if (copyMs === undefined || copyMs > drawMs * 0.7) {
        entry.rejected = true;
        this.counters.rejected++;
        return;
      }
      entry.surface = surface;
      entry.bytes = canvas.width * canvas.height * 4;
      this.bytes += entry.bytes;
      this.counters.bakes++;
      this.trim(entry);
    };
    const failed = (): void => {
      entry.rejected = true;
      this.counters.rejected++;
    };

    this.baking++;
    let result: Later;
    try {
      result = paint(sctx, surface, true);
    } catch {
      // The frame has been drawn already, and what went wrong in it was reported then.
      this.baking--;
      return failed();
    }
    if (isLater(result)) {
      return result.then(
        () => {
          this.baking--;
          keep();
        },
        () => {
          this.baking--;
          failed();
        },
      );
    }
    this.baking--;
    keep();
  }

  /** How long copying the picture takes, on a canvas of its own so that the frame is not touched. */
  private timeCopy(surface: ICanvas, canvas: ICanvas): number | undefined {
    if (
      !this.scratch ||
      this.scratch.width !== canvas.width ||
      this.scratch.height !== canvas.height
    ) {
      this.scratch = this.adapter.createCanvas(canvas.width, canvas.height);
    }
    const target = this.scratch.getContext("2d");
    const start = flush(target);
    if (start === undefined) return undefined;
    this.blit(target, surface);
    const end = flush(target);
    return end === undefined ? undefined : end - start;
  }

  /** Drops the least recently used pictures until what is held is inside the limits. */
  private trim(keep: Entry): void {
    let held = 0;
    for (const entry of this.entries.values()) if (entry.surface) held++;
    for (const entry of this.entries.values()) {
      if (this.bytes <= this.maxBytes && held <= this.maxEntries) break;
      if (entry === keep || !entry.surface) continue;
      entry.surface = undefined;
      this.bytes -= entry.bytes;
      entry.bytes = 0;
      held--;
      this.counters.evictions++;
      // Seen again, it will be drawn and looked at anew.
      entry.seen = 0;
    }
  }

  /** Copies a picture onto the canvas as it is, whatever the canvas is set to. */
  private blit(ctx: ICanvasRenderingContext2D, surface: ICanvas): void {
    const c = ctx as ICanvasRenderingContext2D & { setTransform: (...m: number[]) => void };
    ctx.save();
    try {
      c.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(surface, 0, 0);
    } finally {
      ctx.restore();
    }
  }
}

/**
 * Makes the canvas do everything it has been told to, and says what time it is when that is done. A canvas
 * that draws lazily does it when pixels are read; one pixel is enough to ask for that.
 */
function flush(ctx: ICanvasRenderingContext2D): number | undefined {
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    return undefined;
  }
  return performance.now();
}

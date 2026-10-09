import type { AnyColumnDirection, AnyTextDirection, AnyVerticalTextMode } from "../types";

/**
 * One piece of text occupying a single slot in a column.
 */
export interface VerticalTextUnit {
  /** The text drawn in this slot: a whole word, or a single character. */
  text: string;
  /** Left edge of the unit, relative to the block's top-left corner. */
  x: number;
  /** Top edge of the unit, relative to the block's top-left corner. */
  y: number;
  /** Index of this unit's first character in the original string. */
  startOffset: number;
  /** Zero-based column index, counted in reading order. */
  column: number;
}

/**
 * A laid-out block of vertical text.
 */
export interface VerticalTextLayout {
  units: VerticalTextUnit[];
  /** Width of the whole block, across all columns. */
  width: number;
  /** Height of the whole block, i.e. the tallest column. */
  height: number;
  /** Number of columns the text was broken into. */
  columns: number;
}

export interface VerticalTextOptions {
  text: string;
  /** Must be a vertical direction; see {@link isVerticalDirection}. */
  direction: AnyTextDirection;
  mode: AnyVerticalTextMode;
  columnDirection: AnyColumnDirection;
  /** Height of one slot, i.e. the vertical advance per unit. */
  lineHeight: number;
  /**
   * Height the text has to fit into. Text wraps into a new column once a
   * column is full. Zero or less means a single column of unlimited length.
   */
  maxHeight: number;
  /** Space between columns. */
  columnGap?: number;
  /** Measures the drawn width of a piece of text. */
  measure: (text: string) => number;
}

/**
 * Whether a direction lays text out in columns rather than in rows.
 *
 * @param {AnyTextDirection} [direction] - The direction to test.
 * @returns {boolean} True for `ttb` and `btt`.
 */
export function isVerticalDirection(direction?: AnyTextDirection): boolean {
  return direction === "ttb" || direction === "btt";
}

/**
 * A direction the canvas itself understands, or undefined for vertical
 * directions, which are laid out by hand.
 *
 * `ctx.direction` only accepts `ltr`, `rtl` and `inherit`; assigning anything
 * else is ignored by some engines and throws in others.
 *
 * @param {AnyTextDirection} [direction] - The layer's direction.
 * @returns {"ltr" | "rtl" | "inherit" | undefined} A value safe to assign.
 */
export function canvasDirection(
  direction?: AnyTextDirection,
): "ltr" | "rtl" | "inherit" | undefined {
  if (direction === "ltr" || direction === "rtl" || direction === "inherit") return direction;
  return undefined;
}

/** A unit of text plus where it started in the original string. */
interface RawUnit {
  text: string;
  startOffset: number;
}

/**
 * Minimal shape of `Intl.Segmenter`, declared locally because the package
 * targets ES2020 and the built-in typings only appear from ES2022.
 */
interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string; index: number }>;
}

const SEGMENTER: GraphemeSegmenter | undefined = (() => {
  const ctor = (
    Intl as unknown as {
      Segmenter?: new (locale?: string, options?: { granularity: string }) => GraphemeSegmenter;
    }
  ).Segmenter;
  return ctor ? new ctor(undefined, { granularity: "grapheme" }) : undefined;
})();

/**
 * Splits a line into the pieces that each take one slot in a column.
 *
 * In `ideographs` mode that is one grapheme per slot, so an emoji or a
 * combining sequence stays whole instead of being torn apart by code unit.
 */
function splitUnits(line: string, offset: number, mode: AnyVerticalTextMode): RawUnit[] {
  if (mode === "words") {
    const units: RawUnit[] = [];
    const re = /\S+/g;
    let match: RegExpExecArray | null = re.exec(line);
    while (match !== null) {
      units.push({ text: match[0], startOffset: offset + match.index });
      match = re.exec(line);
    }
    return units;
  }

  const units: RawUnit[] = [];
  if (SEGMENTER) {
    for (const { segment, index } of SEGMENTER.segment(line)) {
      units.push({ text: segment, startOffset: offset + index });
    }
  } else {
    let index = 0;
    for (const ch of line) {
      units.push({ text: ch, startOffset: offset + index });
      index += ch.length;
    }
  }
  return units;
}

/**
 * Lays text out in vertical columns.
 *
 * Coordinates are relative to the top-left corner of the block, so the caller
 * only has to translate. Units are centred across their column, and columns are
 * as wide as their widest unit.
 *
 * `\n` always starts a new column. Otherwise a column breaks once it is full,
 * which only happens when `maxHeight` is set.
 *
 * @param {VerticalTextOptions} [opts] - Text, direction, metrics and a measurer.
 * @returns {VerticalTextLayout} Positioned units and the block's size.
 */
export function layoutVerticalText(opts: VerticalTextOptions): VerticalTextLayout {
  const { text, direction, mode, columnDirection, lineHeight, maxHeight, measure } = opts;
  const columnGap = opts.columnGap ?? 0;

  const perColumn =
    maxHeight > 0 ? Math.max(1, Math.floor(maxHeight / lineHeight)) : Number.POSITIVE_INFINITY;

  // Break into columns: explicitly at newlines, then by capacity.
  const columns: RawUnit[][] = [];
  let current: RawUnit[] = [];
  let offset = 0;

  for (const line of text.split("\n")) {
    for (const unit of splitUnits(line, offset, mode)) {
      if (current.length >= perColumn) {
        columns.push(current);
        current = [];
      }
      current.push(unit);
    }
    offset += line.length + 1; // +1 for the newline itself
    if (current.length > 0) {
      columns.push(current);
      current = [];
    }
  }
  if (current.length > 0) columns.push(current);

  if (columns.length === 0) return { units: [], width: 0, height: 0, columns: 0 };

  const widths = columns.map((column) =>
    column.reduce((max, u) => Math.max(max, measure(u.text)), 0),
  );
  const tallest = columns.reduce((max, column) => Math.max(max, column.length), 0);

  const blockWidth = widths.reduce((sum, w) => sum + w, 0) + columnGap * (columns.length - 1);
  const blockHeight = tallest * lineHeight;

  // Offset of each column from the block's left edge, in reading order.
  const columnX: number[] = [];
  let cursor = 0;
  for (let i = 0; i < columns.length; i++) {
    columnX.push(columnDirection === "rl" ? blockWidth - cursor - widths[i] : cursor);
    cursor += widths[i] + columnGap;
  }

  const units: VerticalTextUnit[] = [];
  for (let c = 0; c < columns.length; c++) {
    const column = columns[c];
    for (let i = 0; i < column.length; i++) {
      const unitWidth = measure(column[i].text);
      // `btt` fills the same box from the bottom up, so both directions occupy
      // the same rectangle and only the reading order differs.
      const slot = direction === "btt" ? column.length - 1 - i : i;
      units.push({
        text: column[i].text,
        x: columnX[c] + (widths[c] - unitWidth) / 2,
        y: slot * lineHeight,
        startOffset: column[i].startOffset,
        column: c,
      });
    }
  }

  return { units, width: blockWidth, height: blockHeight, columns: columns.length };
}

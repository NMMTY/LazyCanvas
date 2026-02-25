import { Div, LineLayer } from "../structures/components";
import { ColorType } from "../types";

const Utils = {
  grid(size: { x: number; y: number }, opts?: gridOptions): Div {
    if (size.x === undefined || size.y === undefined) {
      throw new Error("Size must have x and y properties");
    }

    const options = {
      cellWith: 10,
      cellHeight: 10,
      startX: 0,
      startY: 0,
      endX: size.x,
      endY: size.y,
      color: "rgba(0, 0, 0, 0.5)",
      lineWidth: 1,
      ...opts,
    } as gridOptionsNormalized;

    return new Div()
      .setID(
        `grid-${options.cellWith}-${options.cellHeight}-${options.startX}-${options.startY}-${options.endX}-${options.endY}`,
      )
      .add(
        ...Array.from(
          { length: Math.ceil((options.endX - options.startX) / options.cellWith) },
          (_, i) => {
            const x = options.startX + i * options.cellWith;
            return new LineLayer()
              .setPosition(x, options.startY, x, options.endY)
              .setColor(options.color)
              .setStroke(options.lineWidth);
          },
        ),
        ...Array.from(
          { length: Math.ceil((options.endY - options.startY) / options.cellHeight) },
          (_, i) => {
            const y = options.startY + i * options.cellHeight;
            return new LineLayer()
              .setPosition(options.startX, y, options.endX, y)
              .setColor(options.color)
              .setStroke(options.lineWidth);
          },
        ),
      );
  },
  box(start: { x: number; y: number }, end: { x: number; y: number }, opts?: options): Div {
    if (
      start.x === undefined ||
      start.y === undefined ||
      end.x === undefined ||
      end.y === undefined
    ) {
      throw new Error("Start and end must have x and y properties");
    }

    if (opts === undefined) opts = {};

    if (opts.color === undefined) opts.color = "rgba(0, 0, 0, 0.5)";
    if (opts.lineWidth === undefined) opts.lineWidth = 1;

    return new Div()
      .setID(`box-${start.x}-${start.y}-${end.x}-${end.y}`)
      .add(
        new LineLayer()
          .setPosition(start.x, start.y, end.x, start.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(end.x, start.y, end.x, end.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(end.x, end.y, start.x, end.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
        new LineLayer()
          .setPosition(start.x, end.y, start.x, start.y)
          .setColor(opts.color)
          .setStroke(opts.lineWidth),
      );
  },
};

interface options {
  color?: ColorType;
  lineWidth?: number;
}

interface gridOptions extends options {
  cellWith?: number;
  cellHeight?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface gridOptionsNormalized {
  cellWith: number;
  cellHeight: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: ColorType;
  lineWidth: number;
}

export { Utils };

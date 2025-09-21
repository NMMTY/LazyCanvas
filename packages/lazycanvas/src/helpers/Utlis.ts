import { Group, LineLayer } from "../structures/components";
import { ColorType } from "../types";

const Utils = {
    grid(size: { x: number, y: number }, opts?: gridOptions): Group {

        if (size.x === undefined || size.y === undefined) {
            throw new Error("Size must have x and y properties");
        }

        if (opts === undefined) opts = {};

        if (opts.cellWith === undefined) opts.cellWith = 10;
        if (opts.cellHeight === undefined) opts.cellHeight = 10;
        if (opts.startX === undefined) opts.startX = 0;
        if (opts.startY === undefined) opts.startY = 0;
        if (opts.endX === undefined) opts.endX = size.x;
        if (opts.endY === undefined) opts.endY = size.y;
        if (opts.color === undefined) opts.color = 'rgba(0, 0, 0, 0.5)';
        if (opts.lineWidth === undefined) opts.lineWidth = 1;

        const options = { ...opts } as unknown as gridOptionsNormalized;

        return new Group()
            .setID(`grid-${options.cellWith}-${options.cellHeight}-${options.startX}-${options.startY}-${options.endX}-${options.endY}`)
            .add(
                ...Array.from({ length: Math.ceil((options.endX - options.startX) / options.cellWith) }, (_, i) => {
                    const x = options.startX + i * options.cellWith;
                    return new LineLayer()
                        .setPosition(x, options.startY)
                        .setEndPosition(x, options.endY)
                        .setColor(options.color)
                        .setStroke(options.lineWidth);
                }),
                ...Array.from({ length: Math.ceil((options.endY - options.startY) / options.cellHeight) }, (_, i) => {
                    const y = options.startY + i * options.cellHeight;
                    return new LineLayer()
                        .setPosition(options.startX, y)
                        .setEndPosition(options.endX, y)
                        .setColor(options.color)
                        .setStroke(options.lineWidth);
                })
            )
    },
    box(start: { x: number, y: number }, end: { x: number, y: number }, opts?: options): Group {
        if (start.x === undefined || start.y === undefined || end.x === undefined || end.y === undefined) {
            throw new Error("Start and end must have x and y properties");
        }

        if (opts === undefined) opts = {};

        if (opts.color === undefined) opts.color = 'rgba(0, 0, 0, 0.5)';
        if (opts.lineWidth === undefined) opts.lineWidth = 1;

        return new Group()
            .setID(`box-${start.x}-${start.y}-${end.x}-${end.y}`)
            .add(
                new LineLayer()
                    .setPosition(start.x, start.y)
                    .setEndPosition(end.x, start.y)
                    .setColor(opts.color)
                    .setStroke(opts.lineWidth),
                new LineLayer()
                    .setPosition(end.x, start.y)
                    .setEndPosition(end.x, end.y)
                    .setColor(opts.color)
                    .setStroke(opts.lineWidth),
                new LineLayer()
                    .setPosition(end.x, end.y)
                    .setEndPosition(start.x, end.y)
                    .setColor(opts.color)
                    .setStroke(opts.lineWidth),
                new LineLayer()
                    .setPosition(start.x, end.y)
                    .setEndPosition(start.x, start.y)
                    .setColor(opts.color)
                    .setStroke(opts.lineWidth)
            );
    }

}

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

export { Utils }
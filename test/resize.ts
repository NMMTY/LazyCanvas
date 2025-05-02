import { LazyCanvas, ImageLayer, Exporter } from "../src";

const canvas = new LazyCanvas({ debug: true })
    .create(24, 24)
    .setExportType('svg');

canvas.manager.layers.add(
    new ImageLayer()
    .setPosition(12, 12)
    .setSize(24, 24)
        .setSrc('./logo.png')
)

new Exporter(canvas).export('svg', { name: 'resize', saveAsFile: true })
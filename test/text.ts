import {LazyCanvas, TextLayer, Export, TextAlign, FontsList, Exporter} from "../src";
import { SvgExportFlag } from "@napi-rs/canvas";

const canvas = new LazyCanvas()
    .create(300, 100)
    .setExportType(Export.SVG)
    .setSvgExportFlag(SvgExportFlag.ConvertTextToPaths);

canvas.manager.layers.add(
        new TextLayer()
        .setText("NMMTY")
        .setPosition(150, 85)
        .setColor("#ff8a8a")
        .setFont(FontsList.GeistMono_Black(50))
        .setAlign(TextAlign.Center)
)

new Exporter(canvas).export('png', { name: 'test', saveAsFile: true })
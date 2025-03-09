import { LazyCanvas, TextLayer, saveFile, SaveFormat, Export, TextAlign, FontsList } from "../dist";
import { SvgExportFlag } from "@napi-rs/canvas";

const canvas = new LazyCanvas()
    .create(300, 100)
    .setExportType(Export.SVG)
    .setSvgExportFlag(SvgExportFlag.ConvertTextToPaths);

canvas.layers.add(
        new TextLayer()
        .setText("NMMTY")
        .setPosition(150, 85)
        .setColor("#ff8a8a")
        .setFont(FontsList.GeistMono_Black(50))
        .setAlign(TextAlign.Center)
)

canvas.render.render().then(async (buffer) => {
    console.log("Saved")
    await saveFile(buffer, SaveFormat.SVG, "example")
})

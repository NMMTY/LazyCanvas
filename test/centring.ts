import { MorphLayer, LazyCanvas, saveFile, Centring, SaveFormat } from "../dist";

let arr = ['start', 'start-top', 'start-bottom', 'center', 'center-top', 'center-bottom', 'end', 'end-top', 'end-bottom'];

arr.forEach( async (item, index) => {
    const canvas = new LazyCanvas()
        .create(400, 400);

    canvas.layers.add(
        new MorphLayer()
            .setPosition(200, 200)
            .setColor("rgb(0, 200, 0)")
            .setSize(200, 200, 0)
            .setCentring(Centring.Center),
    )

    canvas.layers.add(
        new MorphLayer()
            .setPosition(200, 200)
            .setColor("rgba(255, 0, 14, 0.5)")
            .setSize(200, 200, 60)
            .setCentring(item as Centring),
    )

    canvas.render.render().then(async (buffer) => {
        console.log("Saved")
        await saveFile(buffer, SaveFormat.PNG, `centring-${item}`)
    })
})


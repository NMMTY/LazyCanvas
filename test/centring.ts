import {MorphLayer, LazyCanvas, Centring, Exporter} from "../src";

let arr = ['start', 'start-top', 'start-bottom', 'center', 'center-top', 'center-bottom', 'end', 'end-top', 'end-bottom'];

arr.forEach( async (item, index) => {
    const canvas = new LazyCanvas()
        .create(400, 400);

    canvas.manager.layers.add(
        new MorphLayer()
            .setPosition(200, 200)
            .setColor("rgb(0, 200, 0)")
            .setSize(200, 200, 0)
            .setCentring(Centring.Center),
        new MorphLayer()
            .setPosition(200, 200)
            .setColor("rgba(255, 0, 14, 0.5)")
            .setSize(200, 200, 60)
            .setCentring(item as Centring),
    )

    new Exporter(canvas).export('png', { name: `test-${item}`, saveAsFile: true })
})


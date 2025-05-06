import {
    LazyCanvas,
    Group,
    MorphLayer,
    Exporter
} from '../src';


const canvas = new LazyCanvas({ debug: true })
    .create(400, 400)
    .animated()

canvas.manager.animation.setFrameRate(60)
    .setClear(true, 30)

for (let i = 0; i < 200; i++) {
    canvas.manager.layers.add(
        new MorphLayer()
            .setPosition(100 + i, 100 + i)
            .setColor(`hsl(${Math.ceil(i * 1.5)}, 100%, 50%)`)
            .setSize(200, 200, 0)
    )
}

new Exporter(canvas).export('gif', { name: 'animation', saveAsFile: true })
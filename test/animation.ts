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
    .setClear(true, 20)

for (let i = 0; i < 100; i++) {
    canvas.manager.layers.add(
        new Group()
            .add(
                new MorphLayer()
                    .setPosition(100 + i * 2, 100 + i * 2)
                    .setColor(`hsl(${Math.ceil(i * 1.5)}, 100%, 50%)`)
                    .setSize(200, 200, { all: 100 - i / 2 }),
                new MorphLayer()
                    .setPosition(100 + i * 2, 100 + i * 2)
                    .setColor(`hsl(${Math.ceil(300 - (i * 1.5))}, 100%, 50%)`)
                    .setSize(200, 200, { all: 100 - i / 2 })
                    .setFilled(false)
                    .setStroke(1, "round", "round")
            )
    )
}

new Exporter(canvas).export('gif', { name: 'animation', saveAsFile: true })
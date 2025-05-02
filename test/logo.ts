import {Export, FontWeight, Group, LazyCanvas, MorphLayer, Exporter, TextLayer, Pattern, PatternType, ImageLayer } from '../src';

const canvas = new LazyCanvas({ debug: true })
    .create(210, 210)

const pattern = new LazyCanvas()
    .create(200, 200)

pattern.manager.layers.add(
    new ImageLayer()
        .setSize('vw', 'vh')
        .setPosition('50%', '50%')
        .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg")
        .dontResize()
)

canvas.manager.layers.add(
    new Group()
        .add(
            new MorphLayer()
                .setPosition(105, 105)
                .setColor(
                    new Pattern()
                        .setType(PatternType.Repeat)
                        .setSrc(
                            pattern
                        )
                )
                .setSize(200, 200, 100)
                .setShadow('#000000', 10),
            new MorphLayer()
                .setPosition(105, 105)
                .setColor("#ff8a8a")
                .setSize(200, 200, 100)
                .setFilled(false)
                .setStroke(2.5, "round", "round"),
        )
);

for (let i = 1; i < 5; i += 1) {
    canvas.manager.layers.add(
        new MorphLayer()
            .setPosition(105, 105)
            .setColor("#ff8a8a")
            .setSize(185 - (20 * i - (i > 2 ? (i) : 0)), 185 - (20 * i - (i > 2 ? (i) : 0)), 47.5 - (5 * i + (i > 2 ? (i * 0.25) : 0)))
            .setFilled(false)
            .setStroke(2.5, "round", "round")
            .setRotate(45 + (15 * i)),
    )
}

new Exporter(canvas).export('json', { name: 'test', saveAsFile: true })
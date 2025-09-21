import {
    Centring,
    Exporter,
    FontsList,
    Gradient,
    GradientType,
    Group,
    LazyCanvas,
    Link,
    MorphLayer,
    TextLayer
} from "../src";

const canvas = new LazyCanvas({ debug: true })
    .create(800, 780);

canvas.manager.layers.add(
    new MorphLayer()
        .setPosition('50%', '50%')
        .setColor("rgb(255, 255, 255)")
        .setSize(800, 800),
    ...[
        { centring: Centring.None, offset: { x: -0.5, y: -0.5 } },
        { centring: Centring.StartTop, offset: { x: -0.5, y: -0.5 } },
        { centring: Centring.Start, offset: { x: -0.5, y: 0 } },
        { centring: Centring.StartBottom, offset: { x: -0.5, y: 0.5 } },
        { centring: Centring.CenterTop, offset: { x: 0, y: 0.5 } },
        { centring: Centring.Center, offset: { x: 0, y: 0 } },
        { centring: Centring.CenterBottom, offset: { x: 0, y: 0.5 } },
        { centring: Centring.EndTop, offset: { x: 0.5, y: -0.5 } },
        { centring: Centring.End, offset: { x: 0.5, y: 0 } },
        { centring: Centring.EndBottom, offset: { x: 0.5, y: 0.5 } }
    ].flatMap((centring, index) => {

        const layers = (c: { centring: Centring, offset: { x: number, y: number }}, ind: number) => {
            return new Group()
                .setID(`gradient-test-${ind}`)
                .add(
                    ...[0, 45, 90, 135, 180, 225, 270, 315].flatMap((angle, index) => {
                        return [
                            new MorphLayer()
                                .setPosition(50 + 70 * index + 60 * c.offset.x, 50 + 70 * ind + 60 * c.offset.y)
                                .setSize(60, 60, { all: 5 })
                                .setCentring(c.centring)
                                .setColor(
                                    new Gradient()
                                        .setType(GradientType.Linear)
                                        .addStops({ offset: 0, color: "#ff8a8a" }, { offset: 1, color: "#8aff8a" })
                                        .setAngle(angle)
                                )
                                .setID(`gradient${angle}deg${ind}`),
                        ]
                    }),
                )
        }
        return [
            layers(centring, index),
            new TextLayer()
                .setText(`${centring.centring}`)
                .setPosition(690, 50 + index * 70)
                .setColor("#000")
                .setBaseline('middle')
                .setFont(FontsList.GeistMono_Black(20))
                .setAlign('center')
        ]
    }),
        ...[0, 45, 90, 135, 180, 225, 270, 315].flatMap((angle) => {
            return [
                new TextLayer()
                    .setPosition(new Link()
                        .setSource(`gradient${angle}deg9`)
                        .setType('x')
                        .setSpacing(-30), `link-y-gradient${angle}deg9-40`)
                    .setColor("#000")
                    .setAlign('center')
                    .setText(`${angle}°`)
                    .setFont(FontsList.GeistMono_Regular(25))
            ]
})
)


new Exporter(canvas).export('png', { name: 'test', saveAsFile: true })
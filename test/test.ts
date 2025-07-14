import {
    FontWeight,
    ImageLayer,
    LazyCanvas,
    MorphLayer,
    Exporter,
    TextLayer,
    Gradient,
    GradientType,
    LineLayer,
    Filters,
    BezierLayer,
    QuadraticLayer,
    Link,
    Path2DLayer, FontsList, Group
} from "../src";

const canvas = new LazyCanvas({ debug: true })
    .create(800, 800);

canvas.manager.layers.add(
    new MorphLayer()
        .setPosition('50%', '50%')
        .setColor("rgb(255, 255, 255)")
        .setSize(800, 800),
    new Group()
        .setID('rotation-test')
        .add(
            new TextLayer()
                .setText('rotation')
                .setPosition(690, 60)
                .setColor("#000")
                .setBaseline('middle')
                .setFont(FontsList.GeistMono_Black(35))
                .setAlign('center'),
            ...[0, 45, 90, 135, 180, 225, 270, 315].flatMap((angle) => {
                return [
                    new MorphLayer()
                        .setPosition(50 + 70 * (angle / 45), 50)
                        .setColor("rgba(0, 0, 0, 0.8)")
                        .setSize(60, 20, { all: 5 })
                        .setRotate(angle)
                        .setCentring('center')
                        .setID(`${angle}deg`),
                    new TextLayer()
                        .setPosition(`link-x-${angle}deg-0`, `link-y-${angle}deg-60`)
                        .setColor("#000")
                        .setAlign('center')
                        .setText(`${angle}°`)
                        .setFont(FontsList.GeistMono_Regular(25))
                ];
            }),
        ),
    new Group()
        .setID('filter-test')
        .add(
            new TextLayer()
                .setText('filters')
                .setPosition(690, 175)
                .setColor("#000")
                .setBaseline('middle')
                .setFont(FontsList.GeistMono_Black(35))
                .setAlign('center'),
            new ImageLayer()
                .setPosition(65, 175)
                .setSize(90, 90)
                .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg"),
            new ImageLayer()
                .setPosition(165, 175)
                .setSize(90, 90)
                .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg")
                .setFilters(Filters.grayscale(100)),
            new ImageLayer()
                .setPosition(265, 175)
                .setSize(90, 90)
                .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg")
                .setFilters(Filters.sepia(100)),
            new ImageLayer()
                .setPosition(365, 175)
                .setSize(90, 90)
                .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg")
                .setFilters(Filters.invert(100)),
            new ImageLayer()
                .setPosition(465, 175)
                .setSize(90, 90)
                .setSrc("https://i.pinimg.com/736x/e8/4a/62/e84a620bd3535da1cd11590057ee7678.jpg")
                .setFilters(Filters.invert(100)),
        ),
    new Group()
        .setID('gradient-test')
        .add(
            new TextLayer()
                .setText('gradient')
                .setPosition(690, 330)
                .setColor("#000")
                .setBaseline('middle')
                .setFont(FontsList.GeistMono_Black(35))
                .setAlign('center'),
            ...[0, 45, 90, 135, 180, 225, 270, 315].flatMap((angle) => {
                return [
                    new MorphLayer()
                        .setPosition(50 + 70 * (angle / 45), 260)
                        .setSize(60, 60, { all: 5 })
                        .setCentring('center')
                        .setColor(
                            new Gradient()
                                .setType(GradientType.Linear)
                                .addStops({ offset: 0, color: "#ff8a8a" }, { offset: 1, color: "#8aff8a" })
                                .setAngle(angle)
                        )
                        .setID(`gradient${angle}deg`),
                    new MorphLayer()
                        .setPosition(`link-x-gradient${angle}deg-0`, `link-y-gradient${angle}deg-70`)
                        .setSize(60, 60, { all: 5 })
                        .setCentring('center')
                        .setColor(
                            new Gradient()
                                .setType(GradientType.Conic)
                                .setAngle(angle)
                                .addStops({ offset: 0, color: "#8a8aff" }, { offset: 1, color: "#ff8aff" })
                                .setPoints({ x: `link-x-gradient${angle}deg-0`, y: `link-y-gradient${angle}deg-70` })
                        ),
                    new MorphLayer()
                        .setPosition(`link-x-gradient${angle}deg-0`, `link-y-gradient${angle}deg-140`)
                        .setSize(60, 60, { all: 5 })
                        .setCentring('center')
                        .setColor(
                            new Gradient()
                                .setType(GradientType.Radial)
                                .addStops({ offset: 0, color: "#8abfff" }, { offset: 1, color: "#8affe0" })
                                .setPoints({ x: `link-x-gradient${angle}deg-${angle * 0.1}`, y: `link-y-gradient${angle}deg-140`, r: 5 },
                                    { x: `link-x-gradient${angle}deg-0`, y: `link-y-gradient${angle}deg-140`, r: 60 })
                        ),
                    new TextLayer()
                        .setPosition(`link-x-gradient${angle}deg-0`, `link-y-gradient${angle}deg-200`)
                        .setColor("#000")
                        .setAlign('center')
                        .setText(`${angle}°`)
                        .setFont(FontsList.GeistMono_Regular(25))
                ]
            }),
        ),
)

new Exporter(canvas).export('yaml', { name: 'test', saveAsFile: true })


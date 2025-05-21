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
    Path2DLayer
} from "../src";

const canvas = new LazyCanvas({ debug: true })
    .create(800, 800);

canvas.manager.layers.add(
    new MorphLayer()
        .setID('morph')
        .setPosition('25%', 200)
        .setColor("rgb(0, 200, 0)")
        .setSize(250, 250, 0)
        .setFilters(Filters.blur(10))
        .setRotate(45),
    new MorphLayer()
        .setPosition(new Link()
            .setType('x')
            .setSource('bezier')
            .setSpacing(-200), 200)
        .setColor("rgba(255, 0, 14, 1)")
        .setSize(200, 200, 60),
    new TextLayer()
        .setText("Hello, World!")
        .setPosition(300, 500)
        .setColor("hsl(10, 40%, 50%)")
        .setFont("GeistMono", 50, FontWeight.Regular)
        .setShadow('#000000', 10, 10, 10)
        .setWordSpacing(10)
        .setLetterSpacing(10)
        .setRotate(45),
    new TextLayer()
        .setText("Lazy Canvas")
        .setPosition(100, 400)
        .setColor(
            new Gradient()
                .setType(GradientType.Radial)
                .addPoints(
                    { x: 155, y: 455, r: 10 },
                    { x: 150, y: 450, r: 100 }
                ).addStops(
                    { offset: 0, color: "#ffffff" },
                    { offset: 1, color: "rgba(100, 200, 100, 0)" }
                )
        )
        .setFont("Geist", 50, FontWeight.Thin)
        .setMultiline(true, 200, 500),
    new ImageLayer()
        .setPosition('70%', '25%')
        .setSize(200, 200, 60)
        .setSrc("https://i.pinimg.com/1200x/f3/32/19/f332192b2090f437ca9f49c1002287b6.jpg"),
    new BezierLayer()
        .setID('bezier')
        .setPosition('link-x-quadratic-0', 400)
        .setControlPoints({ x: 400, y: 450 }, { x: 600, y: 650 })
        .setEndPosition(600, 600)
        .setColor("rgb(0, 200, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10),
    new QuadraticLayer()
        .setID('quadratic')
        .setPosition(400, 400)
        .setControlPoint(700, 500)
        .setEndPosition(600, 600)
        .setColor("rgb(255, 59, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10),
    new LineLayer()
        .setPosition(200, 400)
        .setEndPosition(600, 600)
        .setColor("rgb(0, 200, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10),
    new Path2DLayer()
        .setPath('M 50 600 L 150 700 L 250 600 Z')
        .setColor("rgb(255, 59, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10)
)

new Exporter(canvas).export('png', { name: 'test', saveAsFile: true })


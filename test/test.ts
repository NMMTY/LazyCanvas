import {
    FontWeight,
    ImageLayer,
    LazyCanvas,
    MorphLayer,
    saveFile,
    SaveFormat,
    TextLayer,
    Gradient,
    GradientType,
    Filters,
    BezierLayer, QuadraticLayer
} from "../dist";

const canvas = new LazyCanvas(true)
    .create(800, 800);

canvas.layers.add(
    new MorphLayer()
        .setPosition(200, 200)
        .setColor("rgb(0, 200, 0)")
        .setSize(250, 250, 0)
        .setFilter(Filters.blur(10))
        .setRotate(45),
    new MorphLayer()
        .setPosition(200, 200)
        .setColor("rgba(255, 0, 14, 0.5)")
        .setSize(200, 200, 60),
    new TextLayer()
        .setText("Hello, World!")
        .setPosition(400, 400)
        .setColor("hsl(300, 100%, 100%)")
        .setFont("GeistMono", 50, FontWeight.Normal)
        .setMultiline(true, 200, 200)
        .setShadow('#000000', 10, 10, 10)
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
                    { offset: 1, color: "#999900" }
                )
        )
        .setFont("Geist", 50, FontWeight.Thin)
        .setMultiline(true, 200, 500),
    new ImageLayer()
        .setPosition(500, 200)
        .setSize(200, 200, 60)
        .setSrc("https://i.pinimg.com/1200x/f3/32/19/f332192b2090f437ca9f49c1002287b6.jpg"),
    new BezierLayer()
        .setPosition(400, 400)
        .setControlPoints({ x: 400, y: 450 }, { x: 600, y: 650 })
        .setEndPoint(600, 600)
        .setColor("rgb(0, 200, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10),
    new QuadraticLayer()
        .setPosition(400, 400)
        .setControlPoint(700, 500)
        .setEndPoint(600, 600)
        .setColor("rgb(255, 59, 0)")
        .setStroke(5, "round", "round", [20, 10], 0, 10)
)

canvas.render.render().then(async (buffer) => {
    console.log("Saved")
    await saveFile(buffer, SaveFormat.PNG, "example")
})



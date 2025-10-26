import {LazyCanvas, TextLayer, TextAlign, Exporter, MorphLayer, FontWeight} from "../src";

const canvas = new LazyCanvas()
    .create(800, 800);

// Reference line - center of canvas
canvas.manager.layers.add(
    new MorphLayer()
        .setPosition('50%', 0)
        .setSize(2, 400)
        .setColor("#ff0000")
)

// Test 1: Normal centered text (without substring colors)
canvas.manager.layers.add(
    new TextLayer()
        .setText("Normal Centered Text")
        .setPosition('50%', 50)
        .setColor("#ffffff")
        .setFont('Geist', 32, FontWeight.Regular)
        .setAlign(TextAlign.Center)
)

// Test 2: Centered text with substring colors
canvas.manager.layers.add(
    new TextLayer()
        .setText("Colored Centered Text")
        .setPosition('50%', 120)
        .setColor("#ffffff",
            { start: 0, end: 7, color: "#ff6b6b" },    // "Colored" in red
            { start: 8, end: 16, color: "#4ecdc4" },   // "Centered" in cyan
            { start: 17, end: 21, color: "#95e1d3" }   // "Text" in light cyan
        )
        .setFont('Geist', 32, FontWeight.Regular)
        .setAlign(TextAlign.Center)
)

// Test 3: Right aligned text (without substring colors)
canvas.manager.layers.add(
    new TextLayer()
        .setText("Normal Right Aligned")
        .setPosition(780, 190)
        .setColor("#ffffff")
        .setFont('Geist', 28, FontWeight.Regular)
        .setAlign(TextAlign.Right)
)

// Test 4: Right aligned text with substring colors
canvas.manager.layers.add(
    new TextLayer()
        .setText("Colored Right Aligned")
        .setPosition(780, 250)
        .setColor("#ffffff",
            { start: 0, end: 7, color: "#ff9f43" },    // "Colored" in orange
            { start: 8, end: 13, color: "#ee5a6f" },   // "Right" in pink
            { start: 14, end: 21, color: "#a29bfe" }   // "Aligned" in purple
        )
        .setFont('Geist', 28, FontWeight.Regular)
        .setAlign(TextAlign.Right)
)

// Test 5: Left aligned text (without substring colors)
canvas.manager.layers.add(
    new TextLayer()
        .setText("Normal Left Aligned")
        .setPosition(20, 190)
        .setColor("#ffffff")
        .setFont('Geist', 28, FontWeight.Regular)
        .setAlign(TextAlign.Left)
)

// Test 6: Left aligned text with substring colors
canvas.manager.layers.add(
    new TextLayer()
        .setText("Colored Left Aligned")
        .setPosition(20, 250)
        .setColor("#ffffff",
            { start: 0, end: 7, color: "#00b894" },    // "Colored" in green
            { start: 8, end: 12, color: "#0984e3" },   // "Left" in blue
            { start: 13, end: 20, color: "#6c5ce7" }   // "Aligned" in violet
        )
        .setFont('Geist', 28, FontWeight.Regular)
        .setAlign(TextAlign.Left)
)


// Test 7: Multiline text with substring colors spanning multiple lines
const text1 = "This is a long text that will span multiple lines and have different colors applied to different parts of the text";
canvas.manager.layers.add(
    new TextLayer()
        .setText(text1)
        .setPosition(20, 300)
        .setColor("#ffffff",
            { start: 0, end: 4, color: "#ff6b6b" },      // "This" - red
            { start: 10, end: 14, color: "#4ecdc4" },    // "long" - cyan
            { start: 15, end: 19, color: "#95e1d3" },    // "text" - light cyan
            { start: 30, end: 34, color: "#feca57" },    // "span" - yellow
            { start: 35, end: 43, color: "#ff9ff3" },    // "multiple" - pink
            { start: 44, end: 49, color: "#54a0ff" },    // "lines" - blue
            { start: 58, end: 68, color: "#00d2d3" },    // "different" - turquoise
            { start: 68, end: 75, color: "#1dd1a1" },    // "colors" - green
            { start: 87, end: 96, color: "#ee5a6f" }    // "different" - coral
        )
        .setFont('Geist', 24, FontWeight.Regular)
        .setMultiline(560, 150)
)

// Test 8: Centered multiline text with colors
const text2 = "Centered multiline text with beautiful colors that flow across lines";
canvas.manager.layers.add(
    new TextLayer()
        .setText(text2)
        .setPosition('50%', 450)
        .setColor("#cccccc",
            { start: 0, end: 8, color: "#ff6348" },      // "Centered" - red-orange
            { start: 9, end: 18, color: "#2ed573" },     // "multiline" - green
            { start: 24, end: 28, color: "#1e90ff" },    // "with" - blue
            { start: 29, end: 38, color: "#ff4757" },    // "beautiful" - red
            { start: 39, end: 45, color: "#ffa502" },    // "colors" - orange
            { start: 51, end: 55, color: "#5352ed" },    // "flow" - purple
            { start: 56, end: 62, color: "#3742fa" }     // "across" - blue
        )
        .setFont('Geist', 22, FontWeight.Regular)
        .setAlign(TextAlign.Center)
        .setMultiline(500, 120)
)

// Task 9: Centered multiline text with colors
const text3 = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam venenatis et nulla sit amet aliquam.";
canvas.manager.layers.add(
    new TextLayer()
        .setText(text3)
        .setPosition(780, 570)
        .setColor("#cccccc",
            { start: 0, end: 5, color: "#ff6348" },      // "Lorem" - red-orange
            { start: 6, end: 11, color: "#2ed573" },     // "ipsum" - green
            { start: 18, end: 21, color: "#1e90ff" },    // "sit" - blue
            { start: 28, end: 39, color: "#ff4757" },    // "consectetur" - red
            { start: 56, end: 62, color: "#ffa502" },    // "Etiam" - orange
            { start: 76, end: 81, color: "#5352ed" },    // "nulla" - purple
            { start: 91, end: 98, color: "#3742fa" }     // "aliquam" - blue
        )
        .setFont('Geist', 22, FontWeight.Regular)
        .setAlign(TextAlign.Right)
        .setMultiline(560, 150)
)

new Exporter(canvas).export('png', { name: 'test', saveAsFile: true })
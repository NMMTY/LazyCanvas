import {
    LazyCanvas,
    Group,
    MorphLayer,
    saveFile
} from '../dist';


const canvas = new LazyCanvas(true)
    .create(400, 400)

canvas.animation.setFrameRate(60)
    .setClear(false)

for (let i = 0; i < 200; i++) {
    canvas.layers.add(
        new MorphLayer()
            .setPosition(100 + i, 100 + i)
            .setColor(`hsl(${Math.ceil(i * 1.5)}, 100%, 50%)`)
            .setSize(200, 200, 0)
    )
}

canvas.render.render().then(async (buffer) => {
    console.log(buffer)
    await saveFile(buffer, 'gif', 'animation')
})

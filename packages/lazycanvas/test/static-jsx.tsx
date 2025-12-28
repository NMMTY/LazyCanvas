/** @jsx createElement */
import { createElement, Scene, Exporter, Div, MorphLayer, TextLayer, FontsList } from "../src";

export async function run() {
  const width = 800;
  const height = 600;

  // Create scene
  const scene = new Scene(width, height);

  scene.load(
    <Div>
      <MorphLayer
        position={{
          x: 300,
          y: 200,
        }}
        size={{
          width: 200,
          height: 200,
        }}
        fillStyle="#ff0000"
      />
      <TextLayer
        position={{
          x: 400,
          y: 450,
        }}
        align="center"
        text="Hello, LazyCanvas!"
        font={FontsList.Geist_Bold(60)}
        fillStyle="#0000ff"
      />
    </Div>,
  );

  await new Exporter(scene).export("png", {
    name: "static-jsx",
    saveAsFile: true,
  });
}

if (require.main === module) {
  run().catch(console.error);
}

/** @jsx createElement */
import {
  createElement,
  Scene,
  Exporter,
  Div,
  MorphLayer,
  TextLayer,
  FontsList,
  Path2DLayer,
  Filters,
  ImageLayer,
  PolygonLayer,
  FontWeight,
} from "../dist";
import { Path2D } from "@napi-rs/canvas";

export async function run() {
  const width = 400;
  const height = 120;

  const data = {
    avatar: "https://i.pinimg.com/736x/6c/e7/df/6ce7df75d5faff92241c1d28320bfe7b.jpg",
    username: "TestUser",
    globalName: "TestUserGlobal",
    data: {
      level: 5,
      rank: 1,
    },
    displayOptions: {
      solid: {
        bg_color: "#000000",
        first_component: "#ffffff",
        second_component: "#422242",
        third_component: "#C30F45",
      },
    },
  };

  // Create scene
  const scene = new Scene(width, height);

  scene.load(
    <Div>
      <MorphLayer
        position={{ x: "50%", y: "50%" }}
        size={{ width: 400, height: 120, radius: { all: 25 } }}
        color={data.displayOptions.solid.bg_color}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M12.5202 28.7737C88.5196 132.274 106.021 61.2737 147.52 56.2737C189.02 51.2737 206.021 59.273 248.52 64.2737C291.02 69.2744 318.021 73.7737 345.02 51.2737C372.02 28.7737 417.021 43.773 420.02 48.7737C423.02 53.7744 420.02 132.274 420.02 132.274L13.5202 134.274C13.5202 134.274 -63.4792 -74.7269 12.5202 28.7737Z",
          )
        }
        color={data.displayOptions.solid.first_component}
        transform={{
          translate: { x: 0, y: 25 },
        }}
        filter={Filters.blur(100)}
        globalComposite={"source-atop"}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M204.637 69.5732C157.137 65.0732 75.1366 62.073 141.637 29.5729C208.137 -2.92716 96.1367 -7.92672 45.6366 11.073C7.65736 25.3619 1.06894 27.2082 0.136608 27.2453V29.5731V102.573H398.137V27.0731C398.137 27.0731 349.637 24.0732 326.637 42.5732C303.636 61.0731 252.137 74.0732 204.637 69.5732Z",
          )
        }
        color={data.displayOptions.solid.second_component}
        transform={{
          translate: { x: 0, y: 35 },
        }}
        filter={Filters.blur(50)}
        globalComposite={"source-atop"}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M7.06006 79.8735C70.5602 88.8734 43.0608 51.8735 99.5606 41.3736C156.06 30.8738 135.061 6.87362 201.561 0.873619C268.061 -5.12638 187.561 20.8733 242.061 45.3735C296.561 69.8736 294.823 30.2734 299.561 47.3735C330.116 157.667 -56.4401 70.8737 7.06006 79.8735Z",
          )
        }
        color={data.displayOptions.solid.third_component}
        transform={{
          translate: { x: 30, y: 50 },
        }}
        filter={Filters.blur(80)}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M42.7071 8.07088C43.0976 7.68035 43.0976 7.04719 42.7071 6.65666L36.3431 0.292702C35.9526 -0.0978226 35.3195 -0.0978226 34.9289 0.292702C34.5384 0.683226 34.5384 1.31639 34.9289 1.70692L40.5858 7.36377L34.9289 13.0206C34.5384 13.4111 34.5384 14.0443 34.9289 14.4348C35.3195 14.8254 35.9526 14.8254 36.3431 14.4348L42.7071 8.07088ZM0 7.36377L8.85328e-10 8.36377L42 8.36377L42 7.36377L42 6.36377L-8.85328e-10 6.36377L0 7.36377Z",
          )
        }
        color={data.displayOptions.solid.third_component}
        transform={{
          translate: { x: 107, y: 52.5 },
        }}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M42.7071 8.07088C43.0976 7.68035 43.0976 7.04719 42.7071 6.65666L36.3431 0.292702C35.9526 -0.0978226 35.3195 -0.0978226 34.9289 0.292702C34.5384 0.683226 34.5384 1.31639 34.9289 1.70692L40.5858 7.36377L34.9289 13.0206C34.5384 13.4111 34.5384 14.0443 34.9289 14.4348C35.3195 14.8254 35.9526 14.8254 36.3431 14.4348L42.7071 8.07088ZM0 7.36377L8.85328e-10 8.36377L42 8.36377L42 7.36377L42 6.36377L-8.85328e-10 6.36377L0 7.36377Z",
          )
        }
        color={data.displayOptions.solid.third_component}
        transform={{
          translate: { x: 100, y: 38 },
        }}
      />
      <Path2DLayer
        path2D={
          new Path2D(
            "M42.7071 8.07088C43.0976 7.68035 43.0976 7.04719 42.7071 6.65666L36.3431 0.292702C35.9526 -0.0978226 35.3195 -0.0978226 34.9289 0.292702C34.5384 0.683226 34.5384 1.31639 34.9289 1.70692L40.5858 7.36377L34.9289 13.0206C34.5384 13.4111 34.5384 14.0443 34.9289 14.4348C35.3195 14.8254 35.9526 14.8254 36.3431 14.4348L42.7071 8.07088ZM0 7.36377L8.85328e-10 8.36377L42 8.36377L42 7.36377L42 6.36377L-8.85328e-10 6.36377L0 7.36377Z",
          )
        }
        color={data.displayOptions.solid.third_component}
        transform={{
          translate: { x: 100, y: 68 },
        }}
      />
      <MorphLayer
        position={{ x: "50%", y: "50%" }}
        size={{ width: 398, height: 118, radius: { all: 24 } }}
        color={data.displayOptions.solid.third_component}
        stroke={{
          width: 2,
        }}
      />
      <ImageLayer
        position={{ x: 340, y: 60 }}
        size={{ width: 80, height: 80, radius: { all: 40 } }}
        src={data.avatar}
      />
      <MorphLayer
        position={{ x: 340, y: 60 }}
        size={{ width: 82, height: 82, radius: { all: 41 } }}
        color={data.displayOptions.solid.third_component}
        stroke={{
          width: 2,
        }}
      />
      <PolygonLayer
        position={{ x: 60, y: 60 }}
        size={{ width: 80, height: 80, radius: 10, count: 6 }}
        color={data.displayOptions.solid.third_component}
        stroke={{
          width: 2,
        }}
      />
      <TextLayer
        position={{ x: 60, y: 60 }}
        text={`${data.data.level - 1}`}
        font={{
          family: "Geist Mono",
          size: 36,
          weight: FontWeight.Regular,
        }}
        color={"#ffffff"}
        align={"center"}
        baseline={"middle"}
        shadow={{
          color: "#000000",
          blur: 2,
        }}
      />
      <PolygonLayer
        position={{ x: 190, y: 60 }}
        size={{ width: 80, height: 80, radius: 10, count: 6 }}
        color={data.displayOptions.solid.third_component}
        stroke={{
          width: 2,
        }}
      />
      <TextLayer
        position={{ x: 190, y: 60 }}
        text={`${data.data.level}`}
        font={{
          family: "Geist Mono",
          size: 36,
          weight: FontWeight.Regular,
        }}
        color={"#ffffff"}
        align={"center"}
        baseline={"middle"}
        shadow={{
          color: "#000000",
          blur: 2,
        }}
      />
      <TextLayer
        position={{ x: 265, y: 60 }}
        text={`UP!`}
        font={{
          family: "Geist Mono",
          size: 36,
          weight: FontWeight.Regular,
        }}
        color={"#ffffff"}
        align={"center"}
        baseline={"middle"}
        shadow={{
          color: "#000000",
          blur: 2,
        }}
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

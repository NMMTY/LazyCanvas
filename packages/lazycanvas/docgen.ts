import { createDocumentation } from "@hitomihiumi/micro-docgen";
import { homepage, version } from "./package.json";

async function main() {
  const docs = await createDocumentation({
    name: "reference",
    version,
    github: homepage,
    tsconfigPath: "./tsconfig.json",
    input: ["src"],
    markdown: true,
    output: "public",
    jsonName: "docs.json",
    clean: true,
    omitTypeLinkerExtension: true,
    customOrder: {
      Classes: {
        Core: ["Scene", "LazyCanvas", "LayersManager", "FontsManager", "LayoutManager"],
        Layers: [
          "BaseLayer",
          "Div",
          "MorphLayer",
          "TextLayer",
          "ImageLayer",
          "LineLayer",
          "QuadraticLayer",
          "BezierLayer",
          "PolygonLayer",
          "Path2DLayer",
        ],
        Animation: ["Signal", "Timeline", "ThreadScheduler"],
        Rendering: ["ModernRenderPipeline", "ClassicRenderPipeline", "BaseRenderPipeline"],
        Helpers: ["Font", "Pattern", "Gradient", "Link", "JSONReader", "YAMLReader"],
        "Node.js": ["Exporter", "APNGEncoder"],
        Errors: ["LazyError"],
      },
    },
  });

  console.log(`Took ${docs.metadata.generationMs}ms to generate the documentation!`);
}

main();

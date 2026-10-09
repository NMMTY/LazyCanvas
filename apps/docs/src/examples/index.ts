import type { ComponentType } from "react";
import Animation from "./animation";
import Effects from "./effects";
import Fills from "./fills";
import Hello from "./hello";
import Layout from "./layout";
import Reactive from "./reactive";
import Shapes from "./shapes";
import TextExample from "./text";

/** Every live example, by the file name used in `<Example name="…" />`. */
export const examples: Record<string, ComponentType> = {
  animation: Animation,
  effects: Effects,
  fills: Fills,
  hello: Hello,
  layout: Layout,
  reactive: Reactive,
  shapes: Shapes,
  text: TextExample,
};

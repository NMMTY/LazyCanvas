import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "node/index": "src/node/index.ts",
    "fonts/index": "src/fonts/index.ts",
    "jsx-runtime": "src/jsx-runtime.ts",
    "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  // Entry points share classes (`Exporter` checks `instanceof Scene`), so they
  // must share chunks instead of each bundling its own copy.
  splitting: true,
  treeshake: true,
  clean: true,
  target: "es2020",
  outDir: "dist",
});

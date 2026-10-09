import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.tsx" },
  format: ["esm", "cjs"],
  external: ["react", "react/jsx-runtime"],
  dts: true,
  clean: true,
  banner: { js: '"use client";' },
  target: "es2020",
  outDir: "dist",
});

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests import the workspace packages by name and are resolved straight to
 * TypeScript sources, so a failing test points at real source lines and no
 * build step is needed before running them.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@nmmty/lazycanvas/node": resolve(__dirname, "packages/lazycanvas/src/node/index.ts"),
      "@nmmty/lazycanvas/fonts": resolve(__dirname, "packages/lazycanvas/src/fonts/index.ts"),
      "@nmmty/lazycanvas": resolve(__dirname, "packages/lazycanvas/src/index.ts"),
      "@nmmty/adapter-node": resolve(__dirname, "packages/adapter-node/src/index.ts"),
      "@nmmty/adapter-browser": resolve(__dirname, "packages/adapter-browser/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});

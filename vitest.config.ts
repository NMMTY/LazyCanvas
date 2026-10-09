import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests import the workspace packages by name and are resolved straight to
 * TypeScript sources, so a failing test points at real source lines and no
 * build step is needed before running them.
 *
 * Browser-flavoured tests opt into a DOM with a `@vitest-environment happy-dom`
 * docblock at the top of the file.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@nmmty/lazycanvas/node": resolve(__dirname, "packages/lazycanvas/src/node/index.ts"),
      "@nmmty/lazycanvas/fonts": resolve(__dirname, "packages/lazycanvas/src/fonts/index.ts"),
      "@nmmty/lazycanvas/jsx-dev-runtime": resolve(
        __dirname,
        "packages/lazycanvas/src/jsx-dev-runtime.ts",
      ),
      "@nmmty/lazycanvas/jsx-runtime": resolve(__dirname, "packages/lazycanvas/src/jsx-runtime.ts"),
      "@nmmty/lazycanvas": resolve(__dirname, "packages/lazycanvas/src/index.ts"),
      "@nmmty/adapter-node": resolve(__dirname, "packages/adapter-node/src/index.ts"),
      "@nmmty/adapter-browser": resolve(__dirname, "packages/adapter-browser/src/index.ts"),
      "@nmmty/adapter-react": resolve(__dirname, "packages/adapter-react/src/index.tsx"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: false,
  },
});

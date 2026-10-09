/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@nmmty/lazycanvas", "@nmmty/adapter-browser", "@nmmty/adapter-react"],
  serverExternalPackages: ["@napi-rs/canvas"],

  // yoga-layout loads its wasm with a top-level await, which webpack only
  // emits correctly when these two are enabled. Nothing else about LazyCanvas
  // needs webpack configuration: the main entry point is free of Node
  // built-ins, so no fallbacks or module stubs are required.
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    return config;
  },
};

export default nextConfig;

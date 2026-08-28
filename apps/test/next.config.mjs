/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@nmmty/lazycanvas",
    "@nmmty/adapter-browser",
    "@nmmty/adapter-react",
  ],
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;

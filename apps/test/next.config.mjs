import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stubPath = path.resolve(__dirname, "src/stub.js");

const nodeModules = [
  "fs", "path", "zlib", "stream", "buffer", "util", "crypto",
  "http", "https", "os", "net", "tls", "child_process", "assert", "url",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      new URL("https://avatars.steamstatic.com/**"),
      new URL("https://avatars.fastly.steamstatic.com/**"),
      new URL("https://shared.fastly.steamstatic.com/community_assets/images/**"),
      new URL("https://community.fastly.steamstatic.com/public/images/**"),
      new URL("https://cdn.cloudflare.steamstatic.com/steam/**"),
      new URL("https://static-cdn.jtvnw.net/previews-ttv/**"),
      new URL("https://i.ytimg.com/vi/**"),
      new URL("https://i.scdn.co/image/**"),
      new URL("https://i.pinimg.com/736x/**"),
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: [
    "@nmmty/lazycanvas",
    "@nmmty/lazycanvas-adapter-browser",
    "@nmmty/lazycanvas-react",
  ],
  serverExternalPackages: [
    "@napi-rs/canvas",
  ],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
    };
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        zlib: false,
        stream: false,
        crypto: false,
        buffer: false,
        util: false,
        assert: false,
        url: false,
        http: false,
        https: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };

      // Alias node:* to stub for browser builds
      for (const mod of nodeModules) {
        config.resolve.alias[`node:${mod}`] = stubPath;
      }

      class NodeStubPlugin {
        apply(compiler) {
          const wp = compiler.webpack;
          if (wp && wp.NormalModuleReplacementPlugin) {
            for (const mod of nodeModules) {
              new wp.NormalModuleReplacementPlugin(
                new RegExp(`^node:${mod}$`),
                stubPath,
              ).apply(compiler);
            }
          }
        }
      }

      config.plugins.push(new NodeStubPlugin());
    }
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the file-tracing root to this app (the repo has multiple lockfiles, which
// otherwise makes Next infer the monorepo root and emit a warning).
const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: here,
  images: { remotePatterns: [] },
  webpack: (config) => {
    // Wallet SDKs pull optional deps that aren't used in the browser build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;

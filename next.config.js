import path from "node:path";
import { fileURLToPath } from "node:url";

import "./src/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  // Use this app folder as the root when another lockfile exists higher on disk (avoids bad tracing / chunk resolution).
  outputFileTracingRoot: __dirname,
  /**
   * Optional: reverse-proxy Open Paper in production so the browser never talks to another origin.
   * Example when OPENPAPER_PUBLIC_PROXY_TARGET=https://api.example.com :
   *   rewrites: async () => [{ source: "/openpaper-proxy/:path*", destination: `${process.env.OPENPAPER_PUBLIC_PROXY_TARGET}/:path*` }],
   * FratNotes API routes already proxy server-side via OPENPAPER_API_URL; this is only for direct client calls.
   */
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default config;

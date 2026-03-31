import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default config;

import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sides/bridge"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  devIndicators: false,
};

export default config;

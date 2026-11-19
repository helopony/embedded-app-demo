import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  agentRules: false,
  devIndicators: false,
};

export default config;

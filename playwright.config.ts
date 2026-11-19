import { defineConfig } from "@playwright/test";

const deployed = process.env.DEMO_BASE_URL;
const baseURL = deployed ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: deployed ? undefined : {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});

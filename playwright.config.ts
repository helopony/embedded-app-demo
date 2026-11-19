import { defineConfig } from "@playwright/test";

const deployed = process.env.DEMO_BASE_URL;
const baseURL = deployed ?? "http://localhost:3000";
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: deployed ? undefined : [
    { command: "npm run dev -w @workspace/admin", url: baseURL, reuseExistingServer },
    { command: "npm run dev -w @workspace/partner", url: "http://127.0.0.1:3001/embed/overview", reuseExistingServer },
  ],
});

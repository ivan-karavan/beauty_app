import { defineConfig } from "@playwright/test";

const baseURL = `http://127.0.0.1:5173${process.env.SITE_PATH || "/"}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.js",
  fullyParallel: true,
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    channel: process.env.PW_BROWSER_CHANNEL,
  },
  webServer: {
    command: "npm start",
    url: baseURL,
    reuseExistingServer: false,
  },
});

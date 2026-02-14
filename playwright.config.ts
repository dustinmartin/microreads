import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3111",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "auth-tests",
      testMatch: /auth\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/session.json"),
      },
      dependencies: ["setup"],
      testIgnore: /auth\/.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev -- --port 3111",
    url: "http://localhost:3111",
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_SECRET: "test-secret-for-e2e",
      DATABASE_PATH: path.join(__dirname, "data", "test-microread.db"),
      NODE_ENV: "test",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * End-to-end tests run against the live stack: this console's dev server
 * (:3002) and the API (:4000) with its M6 seed. Chromium comes from the
 * pre-installed browsers (/opt/pw-browsers) or PW_CHROMIUM_PATH.
 */
const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM_PATH || (fs.existsSync(local) ? local : undefined);

const browser = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } };
export const STATE = "test-results/.session.json";

export default defineConfig({
  testDir: "./e2e",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Africa/Lagos",
    locale: "en-NG",
  },
  projects: [
    // signs in once (password + TOTP) and keeps the cookies for the console tests
    { name: "setup", testMatch: /session\.setup\.ts/, use: { ...browser } },
    { name: "auth", testMatch: /auth\.spec\.ts/, use: { ...browser } },
    // the gateway's CSRF origin rules: pure checks and plain requests, no sign-in needed
    { name: "gateway", testMatch: /origin\.spec\.ts/, use: { ...browser } },
    { name: "console", testIgnore: /auth\.spec\.ts|session\.setup\.ts|origin\.spec\.ts/, dependencies: ["setup"], use: { ...browser, storageState: STATE } },
  ],
});

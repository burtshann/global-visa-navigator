import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  forbidOnly: Boolean(process.env.CI),
  reporter: [[process.env.CI ? "github" : "list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    env: {
      DATABASE_URL: "",
      POLICY_SOURCE: "snapshot",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require=./e2e/server-clock.cjs"].filter(Boolean).join(" "),
    },
    url: baseURL,
    reuseExistingServer: false,
  },
});

import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, PREVIEW_ORIGIN } from "./tests/e2e/fixtures";

/**
 * End-to-end suite. Needs built frontends first (`npm run build`); the API runs against an
 * in-memory MongoDB, so no .env or database is required. See tests/e2e/README.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx tests/e2e/server.ts",
      url: `${E2E_ORIGIN}/api/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
    },
    {
      command: "npm exec -w apps/preview -- vite preview --port 5185 --strictPort",
      url: PREVIEW_ORIGIN,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

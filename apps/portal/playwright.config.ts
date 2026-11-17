import { defineConfig, devices } from "@playwright/test";

// Browser coverage for the flows the unit/integration suites cannot see: the
// first-run workspace creation path, the command palette, the upload entry
// point, and a real publication export download.
const PORT = Number(process.env.PORTAL_E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // The flows share one demo account and one database, so run them in order.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // `next dev` compiles each route on first request; a cold /app page can take
  // well over a minute on a slow Windows runner, so the first test pays for the
  // compile of every route the suite touches.
  timeout: 240_000,
  // Generous per-action timeouts for the same reason: a cold `next dev`
  // compile of the workspace detail route is ~40s on a loaded machine, and a
  // locator waiting for that first render must not be mistaken for a failure.
  expect: { timeout: 60_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    navigationTimeout: 120_000,
    actionTimeout: 120_000,
    launchOptions: { timeout: 300_000 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `next dev` keeps NODE_ENV=development, which is the only mode where the
    // demo session is available, so the suite needs no real sign-in.
    command: `npm run dev -- --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      KAIROS_DEMO_MODE: "true",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-dummy-key-do-not-call",
      BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789",
      NEXT_PUBLIC_BETTER_AUTH_URL: baseURL,
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

const clientPort = process.env.CLIENT_PORT ?? "3000";
const serverPort = process.env.PORT ?? "8081";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      url: `http://127.0.0.1:${serverPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Pass the port explicitly: Next.js also honours the global PORT env var,
      // which is reserved for the API server in this monorepo. Without this,
      // both webServers can bind the same port and the suite times out.
      command: `npm run dev -- --port ${clientPort}`,
      cwd: "client",
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

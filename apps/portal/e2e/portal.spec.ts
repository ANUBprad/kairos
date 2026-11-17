import { test, expect, type Page } from "@playwright/test";

// These tests drive the real app against a real Postgres database in demo
// mode. They do not stub server actions: the workspace is created through the
// same dialog a first-time user sees, and the export is the file the browser
// actually downloads.

function uniqueWorkspaceName() {
  return `E2E Workspace ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function createWorkspace(page: Page) {
  await page.goto("/app/knowledge-bases");
  await page.getByRole("button", { name: /create workspace|^new$/i }).first().click();

  const dialog = page.getByRole("dialog", { name: /create workspace/i });
  await expect(dialog).toBeVisible();

  const name = uniqueWorkspaceName();
  await dialog.locator('input[name="name"]').fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  return name;
}

test("first run can create a workspace and open it", async ({ page }) => {
  const name = await createWorkspace(page);

  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/app\/knowledge-bases\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Sources", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /add source/i })).toBeVisible();
});

test("command palette opens with Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/app");

  const palette = page.getByRole("dialog", { name: "Command palette" });
  const trigger = page.getByRole("button", { name: "Open command palette" });

  // The shortcut is registered in an effect after hydration, and a click on a
  // not-yet-hydrated button is a no-op. Retry the sidebar affordance until the
  // app is interactive rather than sleeping for a guessed delay.
  await expect(async () => {
    await trigger.click();
    await expect(palette).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();

  const search = palette.getByLabel("Search commands");
  await search.fill("configuration");

  // Click the result rather than pressing Enter: Enter runs whichever result
  // sorts first, which is not necessarily the one the query was aimed at.
  const configuration = palette.getByRole("option", { name: /Configuration/ });
  await expect(configuration).toBeVisible();
  await configuration.click();

  await expect(page).toHaveURL(/\/app\/settings$/);
});

test("upload dialog accepts a file and shows it in the queue", async ({ page }) => {
  const name = await createWorkspace(page);
  await page.getByRole("link", { name: new RegExp(name) }).click();

  await page.getByRole("button", { name: /add source/i }).click();
  await page.getByRole("button", { name: /prefer to upload files/i }).click();

  const uploadDialog = page.getByRole("dialog", { name: /upload documents/i });
  await expect(uploadDialog).toBeVisible();

  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: "e2e-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Kairos end-to-end source"),
  });

  await expect(uploadDialog.getByText("e2e-note.txt")).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: /^Upload/ })).toBeEnabled();
});

test("publication export downloads a valid self-contained HTML file", async ({ page }) => {
  await page.goto("/app/publication");

  const exportButton = page.getByRole("button", { name: "Export" });
  await expect(exportButton).toBeVisible();

  await page.getByRole("button", { name: /^HTML/ }).click();

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.html$/);

  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString("utf8");

  expect(content).toMatch(/^<!doctype html>/i);
  expect(content).toContain("<html");
  expect(content).toContain("</html>");
});

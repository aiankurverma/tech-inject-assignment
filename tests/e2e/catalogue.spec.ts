import { expect, test } from "@playwright/test";
import { FREE_NAME, FREE_SLUG, PREMIUM_NAME, PREMIUM_SLUG } from "./fixtures";

test("catalogue lists the published components", async ({ page }) => {
  await page.goto("/components");
  await expect(page.getByRole("link", { name: FREE_NAME }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: PREMIUM_NAME }).first()).toBeVisible();
});

test("search finds a component and opens it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search components" }).click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  const input = dialog.getByRole("combobox", { name: "Search components" });
  await input.fill("stat card");
  await expect(dialog.getByRole("option", { name: new RegExp(FREE_NAME) })).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/components/${FREE_SLUG}$`));
});

test("component page renders the live preview and copies code", async ({ page }) => {
  await page.goto(`/components/${FREE_SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: FREE_NAME })).toBeVisible();

  // The preview runs on a separate origin in a sandboxed iframe; wait for it to render.
  const frame = page.frameLocator(`iframe[title="${FREE_NAME} preview"]`);
  await expect(frame.locator("#root > *").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Loading preview...")).toHaveCount(0);

  await page.getByRole("button", { name: "Copy code" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("export");
});

test("premium component is available to a signed-out visitor", async ({ page, request }) => {
  await page.goto(`/components/${PREMIUM_SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: PREMIUM_NAME })).toBeVisible();

  // The preview runs on a separate origin in a sandboxed iframe; wait for it to render.
  const frame = page.frameLocator(`iframe[title="${PREMIUM_NAME} preview"]`);
  await expect(frame.locator("#root > *").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible();

  // Enforced by the server, not only shown in the UI.
  const res = await request.get(`/api/components/${PREMIUM_SLUG}/copy`);
  expect(res.status()).toBe(200);
});

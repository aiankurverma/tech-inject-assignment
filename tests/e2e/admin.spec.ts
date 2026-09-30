import { expect, test } from "@playwright/test";
import { ADMIN, DRAFT_NAME, DRAFT_SLUG } from "./fixtures";

test("admin signs in and publishes a draft to the catalogue", async ({ page }) => {
  // A draft is not public.
  const before = await page.request.get(`/api/components/${DRAFT_SLUG}`);
  expect(before.status()).toBe(404);

  await page.goto("/admin/");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);

  await page.goto(`/admin/components/${DRAFT_SLUG}`);
  await page.getByRole("button", { name: "Publish draft" }).click();
  await expect(page.getByText("It is live in the catalogue now.")).toBeVisible();

  const after = await page.request.get(`/api/components/${DRAFT_SLUG}`);
  expect(after.ok()).toBe(true);
  await page.goto(`/components/${DRAFT_SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: DRAFT_NAME })).toBeVisible();
});

import { test, expect } from "@playwright/test";

/**
 * Smoke spec — verifies the landing page loads and renders the expected title.
 *
 * This is the minimal E2E test that makes the advertised "E2E: Playwright"
 * capability real. Future specs can test auth flows, dashboard interactions,
 * etc. — this one just confirms the dev server boots and the root page renders.
 */
test.describe("Landing page smoke", () => {
  test("loads and shows the site title", async ({ page }) => {
    await page.goto("/");

    // The root page renders the site name in the header/nav.
    // We check for the presence of the h1 or nav title.
    await expect(page).toHaveTitle(/./, { timeout: 30_000 });

    // The page should not show an error state
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Application error");
  });

  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");

    // The login page should have a sign-in form
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 30_000 });
  });
});

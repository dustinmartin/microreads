import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("should show login page with branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Micro Reads" })).toBeVisible();
    await expect(page.getByText("Sign in to your reading library")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("should reject incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("should login with correct password and redirect to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("test-secret-for-e2e");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("should redirect unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated user from settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should persist session across page loads", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Password").fill("test-secret-for-e2e");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    // Navigate to other pages - should not redirect
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Reading Stats" })).toBeVisible();
  });

  test("should redirect /read/ paths to login without session or token", async ({ page }) => {
    // /read/ paths pass through middleware but the page itself checks auth
    // Without a valid session or token, it redirects to /login
    await page.goto("/read/nonexistent-id");
    await expect(page).toHaveURL(/\/login/);
  });
});

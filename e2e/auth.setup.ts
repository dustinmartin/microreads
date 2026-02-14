import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/session.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Password").fill("test-secret-for-e2e");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for redirect to home page
  await expect(page).toHaveURL("/");

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});

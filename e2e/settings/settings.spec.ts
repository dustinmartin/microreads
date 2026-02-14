import { test, expect } from "@playwright/test";

test.describe("settings", () => {
  test("should display settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Configure your daily digest and AI settings")).toBeVisible();
    await expect(page.getByText("Email Delivery")).toBeVisible();
    await expect(page.getByText("AI Configuration")).toBeVisible();
  });

  test("should show form fields with defaults", async ({ page }) => {
    await page.goto("/settings");
    // Wait for loading to finish
    await expect(page.getByText("Loading settings...")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Ollama endpoint URL")).toBeVisible();
    await expect(page.getByLabel("Ollama model name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeVisible();
  });

  test("should save settings and persist across reload", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Loading settings...")).not.toBeVisible({ timeout: 10000 });

    // Fill in settings
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Ollama endpoint URL").fill("http://custom:11434");
    await page.getByLabel("Ollama model name").fill("llama3:8b");

    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByText("Loading settings...")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel("Email address")).toHaveValue("test@example.com");
    await expect(page.getByLabel("Ollama endpoint URL")).toHaveValue("http://custom:11434");
    await expect(page.getByLabel("Ollama model name")).toHaveValue("llama3:8b");
  });

  test("should show Actions section with digest buttons", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Loading settings...")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Today's Digest Now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Test Email" })).toBeVisible();
  });

  test("should navigate home from settings", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");
  });
});

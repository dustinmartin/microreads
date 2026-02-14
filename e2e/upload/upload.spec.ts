import { test, expect } from "@playwright/test";
import { deleteAllBooks, EPUB_PATH } from "../fixtures/test-helpers";

test.describe("upload", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should display upload page elements", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload Book" })).toBeVisible();
    await expect(page.getByText("Add an epub to your reading library")).toBeVisible();
    await expect(page.getByText("Drop your epub file here")).toBeVisible();
    await expect(page.getByText("1,000 words")).toBeVisible();
    // Buttons should be disabled without a file
    await expect(page.getByRole("button", { name: "Add to Active" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add to Queue" })).toBeDisabled();
  });

  test("should navigate back to library", async ({ page }) => {
    await page.goto("/upload");
    await page.getByRole("link", { name: "" }).first().click();
    await expect(page).toHaveURL("/");
  });

  test("should accept epub file and enable buttons", async ({ page }) => {
    await page.goto("/upload");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(EPUB_PATH);

    // File name should be visible
    await expect(page.getByText("example.epub")).toBeVisible();
    // Buttons should be enabled
    await expect(page.getByRole("button", { name: "Add to Active" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Add to Queue" })).toBeEnabled();
  });

  test("should adjust chunk size via slider", async ({ page }) => {
    await page.goto("/upload");
    const slider = page.locator("#chunk-size");
    // Set to 500
    await slider.fill("500");
    await expect(page.getByText("500 words")).toBeVisible();
    // Set to 2000
    await slider.fill("2000");
    await expect(page.getByText("2,000 words")).toBeVisible();
  });

  test("should upload epub as active and show success", async ({ page }) => {
    await page.goto("/upload");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(EPUB_PATH);

    await page.getByRole("button", { name: "Add to Active" }).click();

    // Wait for success state
    await expect(page.getByText("Book uploaded successfully!")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("chunks created")).toBeVisible();

    // Wait for redirect to library
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("should upload epub as queued", async ({ page }) => {
    await page.goto("/upload");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(EPUB_PATH);

    await page.getByRole("button", { name: "Add to Queue" }).click();

    // Wait for success
    await expect(page.getByText("Book uploaded successfully!")).toBeVisible({ timeout: 30000 });

    // Wait for redirect and verify queued section
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Queued" })).toBeVisible();
  });
});

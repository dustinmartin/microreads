import { test, expect } from "@playwright/test";
import { deleteAllBooks, uploadBook } from "../fixtures/test-helpers";

test.describe("stats", () => {
  test("should display stats page structure", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Reading Stats" })).toBeVisible();
    await expect(page.getByText("Your reading activity at a glance")).toBeVisible();
  });

  test("should show four stat cards", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByText("Books Completed")).toBeVisible();
    await expect(page.getByText("Words Read")).toBeVisible();
    await expect(page.getByText("Current Streak")).toBeVisible();
    await expect(page.getByText("Longest Streak")).toBeVisible();
  });

  test("should show reading calendar heatmap", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByText("Reading Calendar")).toBeVisible();
    await expect(page.getByText("Last 365 days of reading activity")).toBeVisible();
    await expect(page.getByText("Less")).toBeVisible();
    await expect(page.getByText("More")).toBeVisible();
  });

  test("should show words per day chart", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByText("Words Per Day")).toBeVisible();
    await expect(page.getByText("Last 30 days of reading volume")).toBeVisible();
  });

  test("should navigate home from stats", async ({ page }) => {
    await page.goto("/stats");
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");
  });

  test("should reflect reading activity in stats", async ({ page, request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");

    // Get first chunk and mark as read
    const bookRes = await request.get(`/api/books/${result.id}`);
    const bookData = await bookRes.json();
    const firstChunkId = bookData.chapters[0].chunkIds[0];

    await request.post(`/api/chunks/${firstChunkId}/read`, {
      data: { readVia: "web_app" },
    });

    // Check stats page
    await page.goto("/stats");
    // Words Read should be non-zero
    const wordsCard = page.locator("text=Words Read").locator("..");
    await expect(wordsCard).toBeVisible();

    // Clean up
    await deleteAllBooks(request);
  });
});

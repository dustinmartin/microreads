import { test, expect } from "@playwright/test";
import { deleteAllBooks, uploadBook } from "../fixtures/test-helpers";

test.describe("reading view", () => {
  let bookId: string;
  let bookTitle: string;
  let firstChunkId: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    bookId = result.id;
    bookTitle = result.title;

    // Get first chunk ID from book detail API
    const bookRes = await request.get(`/api/books/${bookId}`);
    const bookData = await bookRes.json();
    firstChunkId = bookData.chapters[0].chunkIds[0];
  });

  test.afterAll(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should display reading view for first chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);

    // Header shows book title and chunk info
    await expect(page.getByText(bookTitle)).toBeVisible();
    await expect(page.getByText(/Chunk 1 of/)).toBeVisible();

    // Content article is rendered
    const article = page.locator("article");
    await expect(article).toBeVisible();
    const content = await article.textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test("should not show Previous nav link on first chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await expect(page.locator("nav").getByRole("link", { name: "Previous" })).not.toBeVisible();
  });

  test("should show Next nav link on first chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await expect(page.locator("nav").getByRole("link", { name: "Next" })).toBeVisible();
  });

  test("should navigate to next chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await page.locator("nav").getByRole("link", { name: "Next" }).click();

    // Should be on a different chunk now
    await expect(page.getByText(/Chunk 2 of/)).toBeVisible();
    // Previous link should now be visible
    await expect(page.locator("nav").getByRole("link", { name: "Previous" })).toBeVisible();
  });

  test("should navigate back to previous chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await page.locator("nav").getByRole("link", { name: "Next" }).click();
    await expect(page.getByText(/Chunk 2 of/)).toBeVisible();

    await page.locator("nav").getByRole("link", { name: "Previous" }).click();
    await expect(page.getByText(/Chunk 1 of/)).toBeVisible();
  });

  test("should show End of book on last chunk", async ({ page, request }) => {
    // Get last chunk ID
    const bookRes = await request.get(`/api/books/${bookId}`);
    const bookData = await bookRes.json();
    const chapters = bookData.chapters;
    const lastChapter = chapters[chapters.length - 1];
    const lastChunkId = lastChapter.chunkIds[lastChapter.chunkIds.length - 1];

    await page.goto(`/read/${lastChunkId}`);
    await expect(page.getByText("End of book")).toBeVisible();
    await expect(page.locator("nav").getByRole("link", { name: "Next" })).not.toBeVisible();
  });

  test("should show progress bar at bottom", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    // Fixed progress bar at bottom
    const progressBar = page.locator(".fixed.bottom-0");
    await expect(progressBar).toBeVisible();
  });

  test("should mark chunk as read via API", async ({ page, request }) => {
    // Mark first chunk as read via API
    const readRes = await request.post(`/api/chunks/${firstChunkId}/read`, {
      data: { readVia: "web_app" },
    });
    expect(readRes.ok()).toBeTruthy();

    const readData = await readRes.json();
    expect(readData.success).toBeTruthy();

    // Verify progress updated
    const bookRes = await request.get(`/api/books/${bookId}`);
    const bookData = await bookRes.json();
    expect(bookData.book.currentChunkIndex).toBeGreaterThan(0);
  });
});

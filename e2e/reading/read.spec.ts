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

  test("should show Back to Book and Mark Read buttons on first chunk", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await expect(page.getByRole("button", { name: "Back to Book" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Read & Next" })).toBeVisible();
  });

  test("should navigate to next chunk via Mark Read & Next", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await page.getByRole("button", { name: "Mark Read & Next" }).click();

    // Should be on a different chunk now
    await expect(page.getByText(/Chunk 2 of/)).toBeVisible();
  });

  test("should navigate back to book via Back to Book button", async ({ page }) => {
    await page.goto(`/read/${firstChunkId}`);
    await page.getByRole("button", { name: "Back to Book" }).click();

    // Should be on book detail page
    await expect(page).toHaveURL(new RegExp(`/book/${bookId}`));
  });

  test("should show Mark Read & Finish on last chunk", async ({ page, request }) => {
    // Get last chunk ID
    const bookRes = await request.get(`/api/books/${bookId}`);
    const bookData = await bookRes.json();
    const chapters = bookData.chapters;
    const lastChapter = chapters[chapters.length - 1];
    const lastChunkId = lastChapter.chunkIds[lastChapter.chunkIds.length - 1];

    await page.goto(`/read/${lastChunkId}`);
    await expect(page.getByRole("button", { name: "Mark Read & Finish" })).toBeVisible();
    // Should NOT show "Mark Read & Next" on last chunk
    await expect(page.getByRole("button", { name: "Mark Read & Next" })).not.toBeVisible();
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

  test("skip-ahead should advance currentChunkIndex to chunk.index + 1", async ({ request }) => {
    // Reset: delete and re-upload book
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const newBookId = result.id;

    // Get chunks
    const bookRes = await request.get(`/api/books/${newBookId}`);
    const bookData = await bookRes.json();
    const allChunkIds: string[] = bookData.chapters.flatMap(
      (ch: { chunkIds: string[] }) => ch.chunkIds
    );

    // Verify starting at index 0
    expect(bookData.book.currentChunkIndex).toBe(0);

    // Skip ahead: mark chunk at index 4 as read (skipping 0-3)
    const skipIndex = Math.min(4, allChunkIds.length - 2);
    const skipChunkId = allChunkIds[skipIndex];
    const readRes = await request.post(`/api/chunks/${skipChunkId}/read`, {
      data: { readVia: "web_app" },
    });
    expect(readRes.ok()).toBeTruthy();

    // Verify currentChunkIndex advanced to skipIndex + 1
    const updatedRes = await request.get(`/api/books/${newBookId}`);
    const updatedData = await updatedRes.json();
    expect(updatedData.book.currentChunkIndex).toBe(skipIndex + 1);
  });

  test("mark-as-unread should reset currentChunkIndex", async ({ request }) => {
    // Reset: delete and re-upload book
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const newBookId = result.id;

    // Get chunks
    const bookRes = await request.get(`/api/books/${newBookId}`);
    const bookData = await bookRes.json();
    const allChunkIds: string[] = bookData.chapters.flatMap(
      (ch: { chunkIds: string[] }) => ch.chunkIds
    );

    // Mark chunks 0, 1, 2 as read
    for (let i = 0; i <= 2; i++) {
      await request.post(`/api/chunks/${allChunkIds[i]}/read`, {
        data: { readVia: "web_app" },
      });
    }

    // Verify currentChunkIndex is 3
    const midRes = await request.get(`/api/books/${newBookId}`);
    const midData = await midRes.json();
    expect(midData.book.currentChunkIndex).toBe(3);

    // Mark chunk at index 1 as unread
    const unreadRes = await request.post(`/api/chunks/${allChunkIds[1]}/unread`);
    expect(unreadRes.ok()).toBeTruthy();

    const unreadData = await unreadRes.json();
    expect(unreadData.success).toBeTruthy();

    // Verify currentChunkIndex reset to 1
    const finalRes = await request.get(`/api/books/${newBookId}`);
    const finalData = await finalRes.json();
    expect(finalData.book.currentChunkIndex).toBe(1);
  });
});

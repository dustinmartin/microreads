import { test, expect } from "@playwright/test";
import { deleteAllBooks, uploadBook } from "../fixtures/test-helpers";

test.describe("book detail", () => {
  let bookId: string;
  let bookTitle: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    bookId = result.id;
    bookTitle = result.title;
  });

  test.afterAll(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should display book detail page", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await expect(page.getByRole("heading", { name: bookTitle })).toBeVisible();
    await expect(page.getByText("active", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Library" })).toBeVisible();
  });

  test("should show progress bar and stats", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await expect(page.getByText("% complete")).toBeVisible();
    await expect(page.getByText("Chunks Read", { exact: true })).toBeVisible();
    await expect(page.getByText("Words Read", { exact: true })).toBeVisible();
    await expect(page.getByText("Days Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Est. Completion", { exact: true })).toBeVisible();
  });

  test("should show chapter list with chunk links", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await expect(page.getByRole("heading", { name: "Chapters" })).toBeVisible();
    // Should have at least one chapter entry with chunk links (numbered)
    await expect(page.getByRole("link", { name: "1" }).first()).toBeVisible();
  });

  test("should navigate to chunk from chapter list", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("link", { name: "1" }).first().click();
    await expect(page).toHaveURL(/\/read\//);
  });

  test("should navigate back to library", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("link", { name: "Back to Library" }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("book controls - status management", () => {
  let bookId: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    bookId = result.id;
  });

  test.afterAll(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should pause an active book", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("paused")).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  test("should resume a paused book", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("active")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("should mark book as complete", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Mark Complete" }).click();
    await expect(page.getByText("completed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
  });

  test("should restart a completed book", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Restart" }).click();
    await expect(page.getByText("active")).toBeVisible();
    await expect(page.getByText("0% complete")).toBeVisible();
  });
});

test.describe("chunk size control", () => {
  let bookId: string;

  test.beforeAll(async ({ request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    bookId = result.id;
  });

  test.afterAll(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should show chunk size and Adjust button", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await expect(page.getByText(/Chunk size:.*1000.*words/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Adjust" })).toBeVisible();
  });

  test("should open chunk size slider on Adjust click", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("should cancel chunk size adjustment", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    // Should be back to view mode
    await expect(page.getByRole("button", { name: "Adjust" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply" })).not.toBeVisible();
  });
});

test.describe("book deletion", () => {
  let bookId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    bookId = result.id;
  });

  test("should delete book with two-click confirmation", async ({ page }) => {
    await page.goto(`/book/${bookId}`);
    // First click shows confirmation
    await page.getByRole("button", { name: "Delete Book" }).click();
    await expect(page.getByRole("button", { name: "Are you sure?" })).toBeVisible();
    // Second click deletes
    await page.getByRole("button", { name: "Are you sure?" }).click();
    // Should redirect to library
    await expect(page).toHaveURL("/");
  });

  test("should return 404 for nonexistent book", async ({ page }) => {
    const response = await page.goto("/book/nonexistent-book-id");
    expect(response?.status()).toBe(404);
  });
});

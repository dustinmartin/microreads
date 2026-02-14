import { test, expect } from "@playwright/test";
import { deleteAllBooks, uploadBook } from "../fixtures/test-helpers";

test.describe("library - empty state", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllBooks(request);
  });

  test("should show empty state when no books exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Your library is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Upload your first book" })).toBeVisible();
  });

  test("should show Upload Book button in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Upload Book" })).toBeVisible();
  });

  test("should navigate to upload page from empty state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Upload your first book" }).click();
    await expect(page).toHaveURL("/upload");
  });
});

test.describe("library - with books", () => {
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

  test("should show book card in Active section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Active" })).toBeVisible();
    await expect(page.getByText(bookTitle).first()).toBeVisible();
    // Progress bar and status badge
    await expect(page.getByText("0% complete")).toBeVisible();
    await expect(page.getByText("active", { exact: true })).toBeVisible();
  });

  test("should navigate to book detail when clicking a book card", async ({ page }) => {
    await page.goto("/");
    await page.getByText(bookTitle).click();
    await expect(page).toHaveURL(`/book/${bookId}`);
  });

  test("should show Queued section for queued books", async ({ page, request }) => {
    const queued = await uploadBook(request, "queued");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Queued" })).toBeVisible();
    // Both active and queued books have the same title, just verify the section appears
    await expect(page.getByText("queued", { exact: true })).toBeVisible();
    // Clean up
    await request.delete(`/api/books/${queued.id}`);
  });
});

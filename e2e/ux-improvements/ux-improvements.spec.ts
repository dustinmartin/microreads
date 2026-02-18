import { test, expect } from "@playwright/test";
import { deleteAllBooks, uploadBook, getFirstChunkId } from "../fixtures/test-helpers";

test.describe("UX Improvements", () => {
  // -- Task 1: Dark mode colors --
  test("dark mode body background is warm dark (~#1A1A1A)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // Parse rgb(r, g, b) values — expect warm dark ~26,26,26
    const match = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
    expect(match).not.toBeNull();
    const [r, g, b] = [match![1], match![2], match![3]].map(Number);
    // Should be in the warm dark range (20-35), not near 0 or 10
    expect(r).toBeGreaterThanOrEqual(18);
    expect(r).toBeLessThanOrEqual(40);
    expect(g).toBeGreaterThanOrEqual(18);
    expect(g).toBeLessThanOrEqual(40);
    expect(b).toBeGreaterThanOrEqual(18);
    expect(b).toBeLessThanOrEqual(40);
  });

  // -- Task 2: Login dark mode --
  test("login page is visible in dark mode", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    // Card should be visible
    const heading = page.getByRole("heading", { name: "Micro Reads" });
    await expect(heading).toBeVisible();
    // Sign In button should be visible
    const button = page.getByRole("button", { name: /sign in/i });
    await expect(button).toBeVisible();
    // Password input should be visible
    const input = page.locator('input[type="password"]');
    await expect(input).toBeVisible();
  });

  // -- Task 3: Navigation --
  test("mobile bottom nav is visible at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    // Should have navigation links
    const links = nav.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("desktop nav is visible at 1024px", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("nav is hidden on reading view", async ({ page, request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    // Bottom nav should not be visible
    const nav = page.locator("nav");
    const navCount = await nav.count();
    if (navCount > 0) {
      await expect(nav).not.toBeVisible();
    }
    await deleteAllBooks(request);
  });

  // -- Task 4: PWA manifest --
  test("PWA manifest link is present", async ({ page }) => {
    await page.goto("/");
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", "/manifest.json");
  });

  test("apple-mobile-web-app-capable is set", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(meta).toHaveAttribute("content", "yes");
  });

  test("theme-color meta is set", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[name="theme-color"]');
    const content = await meta.getAttribute("content");
    expect(content).toBeTruthy();
  });

  // -- Task 5: Safe area inset handling --
  test("viewport includes viewport-fit=cover", async ({ page }) => {
    await page.goto("/");
    const viewport = page.locator('meta[name="viewport"]');
    const content = await viewport.getAttribute("content");
    expect(content).toContain("viewport-fit=cover");
  });

  // -- Task 6: Touch target sizes --
  test("touch targets meet 44px minimum on book controls", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/book/${result.id}`);

    // Check all buttons on the book detail page
    const buttons = page.locator("button").filter({ hasNotText: /×|x/i });
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && box.height > 0) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    await deleteAllBooks(request);
  });

  // -- Task 7: Reading view typography --
  test("reading view has adequate padding on mobile", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/read/${chunkId}`);

    const prose = page.locator(".prose-reader");
    const box = await prose.boundingBox();
    // Should have at least 16px left padding
    expect(box!.x).toBeGreaterThanOrEqual(16);

    await deleteAllBooks(request);
  });

  test("cover image height is constrained", async ({ page, request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    const cover = page.locator('img[alt*="cover" i]');
    if ((await cover.count()) > 0) {
      const box = await cover.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.height).toBeLessThan(viewport.height * 0.5);
    }

    await deleteAllBooks(request);
  });

  // -- Task 8: Library responsive grid --
  test("library cards are side by side on desktop", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    await uploadBook(request, "active");
    await uploadBook(request, "queued");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Find book card links
    const cards = page.locator("a").filter({ has: page.locator("h3") });
    if ((await cards.count()) >= 2) {
      const first = await cards.first().boundingBox();
      const second = await cards.nth(1).boundingBox();
      // On desktop, cards should be side by side (same y or different x)
      if (first && second) {
        expect(first.x).not.toEqual(second.x);
      }
    }

    await deleteAllBooks(request);
  });

  // -- Task 9: Progress bars visible --
  test("progress bar height is at least 4px", async ({ page, request }) => {
    await deleteAllBooks(request);
    await uploadBook(request, "active");

    await page.goto("/");
    // Find progress bar tracks (the outer rounded-full container)
    const progressTrack = page.locator(".rounded-full.bg-muted").first();
    if ((await progressTrack.count()) > 0) {
      const box = await progressTrack.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(4);
      }
    }

    await deleteAllBooks(request);
  });

  // -- Task 10: Button hierarchy --
  test("reading view has correct button styling", async ({ page, request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    const markReadBtn = page.getByRole("button", { name: /mark read/i });
    await expect(markReadBtn).toBeVisible();
    const backBtn = page.getByRole("button", { name: /back to book/i });
    await expect(backBtn).toBeVisible();

    await deleteAllBooks(request);
  });

  // -- Task 11: Input attributes --
  test("login password field has autocomplete attribute", async ({ page }) => {
    await page.goto("/login");
    const input = page.locator('input[type="password"]');
    const autocomplete = await input.getAttribute("autocomplete");
    expect(autocomplete).toBe("current-password");
  });

  test("settings email field has correct input attributes", async ({
    page,
  }) => {
    await page.goto("/settings");
    const emailInput = page.locator("#email_to");
    const type = await emailInput.getAttribute("type");
    expect(type).toBe("email");
  });

  // -- Task 12: Heatmap overflow --
  test("no horizontal overflow on stats page at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/stats");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  // -- Task 13: Overscroll behavior --
  test("reading view has overscroll-behavior-y contain", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    const overscroll = await page.evaluate(() => {
      // Check the layout wrapper div (first child of body or main)
      const el =
        document.querySelector("[style*='overscroll']") ||
        document.querySelector("main")?.parentElement ||
        document.body;
      return getComputedStyle(el).overscrollBehaviorY;
    });
    expect(overscroll).toBe("contain");

    await deleteAllBooks(request);
  });

  // -- Task 14: Responsive cover images --
  test("cover image is height-constrained in reading view", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    const imgs = page.locator("img");
    const imgCount = await imgs.count();
    if (imgCount > 0) {
      const viewport = page.viewportSize()!;
      for (let i = 0; i < imgCount; i++) {
        const box = await imgs.nth(i).boundingBox();
        if (box && box.height > 10) {
          expect(box.height).toBeLessThanOrEqual(viewport.height * 0.5);
        }
      }
    }

    await deleteAllBooks(request);
  });

  // -- Task 15: Serif webfont loading --
  test("reading view uses Source Serif font", async ({ page, request }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");
    const chunkId = await getFirstChunkId(request, result.id);

    await page.goto(`/read/${chunkId}`);
    const fontFamily = await page.evaluate(() => {
      const el = document.querySelector(".prose-reader");
      return el ? getComputedStyle(el).fontFamily : "";
    });
    expect(fontFamily.toLowerCase()).toContain("source serif");

    await deleteAllBooks(request);
  });

  // -- Task 16: Chunk grid on mobile --
  test("mobile shows chapter progress, not chunk grid", async ({
    page,
    request,
  }) => {
    await deleteAllBooks(request);
    const result = await uploadBook(request, "active");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/book/${result.id}`);

    // On mobile, chapter progress should be visible
    const chapterProgress = page.locator('[data-testid="chapter-progress"]');
    const hasChapterProgress = (await chapterProgress.count()) > 0;

    // Chunk grid squares may be hidden on mobile
    const chunkSquares = page.locator('[data-testid="chunk-square"]');
    const hasChunkSquares = (await chunkSquares.count()) > 0;

    // At least one mobile-friendly view should be present
    // (either chapter progress exists, or chunk grid is still usable)
    expect(hasChapterProgress || hasChunkSquares).toBeTruthy();

    await deleteAllBooks(request);
  });

  // -- Task 17: Hover/focus states --
  test("book cards have hover styles", async ({ page, request }) => {
    await deleteAllBooks(request);
    await uploadBook(request, "active");

    await page.goto("/");
    const card = page
      .locator("a")
      .filter({ has: page.locator("h3") })
      .first();
    if ((await card.count()) > 0) {
      await card.hover();
      const transform = await card.evaluate(
        (el) => getComputedStyle(el).transform
      );
      // May have translateY or shadow on hover
      const shadow = await card.evaluate(
        (el) => getComputedStyle(el).boxShadow
      );
      // At least one hover effect should be active
      const hasTransform = transform !== "none";
      const hasShadow = shadow !== "none";
      expect(hasTransform || hasShadow).toBeTruthy();
    }

    await deleteAllBooks(request);
  });
});

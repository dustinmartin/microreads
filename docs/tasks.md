# UX Improvement Tasks

Tasks derived from the [UX Review](./ux-review.md). Each task is self-contained with context, acceptance criteria, affected files, and testing guidance.

---

## Task 1: Fix Dark Mode Colors

**Priority:** Critical
**Effort:** Small-Medium

### Context

The dark mode background is too dark (near `#0A0A0A` / default black) instead of the spec's warm `#1A1A1A`. Text uses standard gray instead of warm cream `#E8E4DC`. Cards barely differ from the page background. Borders are nearly invisible. The overall feel is cold and harsh instead of warm and literary.

### What to Change

Edit `src/app/globals.css` — the `.dark` block where all dark mode CSS variables are defined using OKLch values.

Update these dark mode variables:
- **Page background:** Change to equivalent of `#1A1A1A` (warm dark, not pure black)
- **Card/popover background:** Change to equivalent of `#242424` (visible lift over page bg)
- **Foreground text:** Change to equivalent of `#E8E4DC` (warm cream, not cool gray)
- **Border color:** Change to equivalent of `#333333` (visible but subtle)
- **Muted foreground:** Ensure sufficient contrast against `#242424` card backgrounds
- **Primary button:** Must be visible against dark backgrounds — invert to light fill or use an accent color

The app uses OKLch color space. Convert the target hex values to OKLch before setting them. Use a tool like `oklch.com` or calculate:
- `#1A1A1A` ≈ `oklch(0.15 0.003 60)`
- `#242424` ≈ `oklch(0.20 0.003 60)`
- `#E8E4DC` ≈ `oklch(0.92 0.01 80)`
- `#333333` ≈ `oklch(0.27 0.003 60)`

Keep the warmth by using a slight chroma value (~0.003-0.01) and a warm hue angle (~60-80) instead of 0 chroma.

### Acceptance Criteria

- [ ] Dark mode page background is warm dark (`~#1A1A1A`), not black
- [ ] Dark mode text is warm cream (`~#E8E4DC`), not cool gray/white
- [ ] Cards have visible lift — their background is clearly distinguishable from the page
- [ ] Borders between cards and sections are visible but subtle
- [ ] Primary buttons are readable against dark backgrounds
- [ ] Muted/secondary text maintains sufficient contrast (WCAG AA: 4.5:1 minimum)
- [ ] All pages look cohesive in dark mode (no jarring bright or invisible elements)

### Files to Edit

- `src/app/globals.css` — the `.dark { }` CSS variable block

### How to Test

**Code review:**
- Grep for the `.dark` block in `globals.css` and verify each variable matches the spec targets
- Verify no hardcoded color values override the variables elsewhere: `grep -r "#0A0A0A\|#000000\|rgb(0" src/`

**Visual (dev server):**
- Toggle dark mode on every page: login, library, upload, reading, book detail, stats, settings
- Verify card backgrounds are visibly distinct from the page background
- Verify text is warm-toned (cream, not blue-white)
- Verify borders are visible between sections

**Playwright:**
- Add a test in `e2e/auth/login.spec.ts` that enables dark mode (add `.dark` class to `<html>`) and screenshots the login page
- Use `page.evaluate` to check computed background-color of `body` and verify it's in the `#1A1A1A` range
- Example:
  ```ts
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const bg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // Parse RGB values and verify they're in the warm dark range (r/g/b ~26)
  ```

---

## Task 2: Fix Dark Mode Login Page

**Priority:** Critical
**Effort:** Small

### Context

The login page in dark mode shows a light gray card against a black background — a jarring disconnect. The Sign In button becomes washed out and nearly invisible. This is the first page users see, so it must look polished.

### What to Change

Edit `src/app/login/page.tsx`. The card and button components likely use shadcn/ui defaults that don't account for the dark theme properly.

- Ensure the login card uses the dark card background variable (should inherit from Task 1's fixes)
- Ensure the Sign In button uses a high-contrast style in dark mode — either a light/white button or a colored accent
- Verify the password input field has visible borders and text in dark mode
- The "Micro Reads" heading and subtitle should use the warm cream text color

### Acceptance Criteria

- [ ] Login card is clearly visible against the dark page background (not a bright gray box)
- [ ] Sign In button has strong contrast and is clearly tappable
- [ ] Password input field has visible borders, placeholder text, and typed text
- [ ] Heading and subtitle use warm cream tones, not cool gray
- [ ] The overall login page looks intentionally designed for dark mode, not broken

### Files to Edit

- `src/app/login/page.tsx`
- `src/app/globals.css` (if Task 1 fixes don't fully resolve this)

### How to Test

**Code review:**
- Check that the card component uses `bg-card` (not a hardcoded color)
- Check that the button uses `bg-primary text-primary-foreground` or a variant that inverts properly in dark mode
- Check that input uses `border-input` and `text-foreground`

**Visual:**
- Navigate to `/login` in dark mode
- The card should have a `#242424` background on a `#1A1A1A` page
- The button should be clearly visible (light text on dark bg, or inverted)
- Type in the password field — text should be warm cream

**Playwright:**
- Extend the existing login tests in `e2e/auth/login.spec.ts`:
  ```ts
  test('login page looks correct in dark mode', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    // Verify card is visible
    const card = page.locator('[data-testid="login-card"]'); // or appropriate selector
    await expect(card).toBeVisible();
    // Verify button is visible and has sufficient contrast
    const button = page.getByRole('button', { name: /sign in/i });
    await expect(button).toBeVisible();
  });
  ```

---

## Task 3: Add Global Navigation

**Priority:** Critical
**Effort:** Medium

### Context

There is no persistent navigation. Each page handles navigation differently — back arrows, "Home" text links, or nothing at all. The app has 7 routes but users must know URLs to navigate between Library, Stats, and Settings. For mobile users, navigation should be in the thumb zone (bottom of screen).

### What to Change

Create a shared navigation component and integrate it into the layout.

**Design:**
- **Mobile (< 768px):** Bottom tab bar with 3 tabs — Library (home icon), Stats (bar chart icon), Settings (gear icon). Fixed to bottom of viewport. Respects safe area insets (see Task 5).
- **Desktop (>= 768px):** Top header bar with the "Micro Reads" branding on the left and nav links (Library, Stats, Settings) on the right.
- The nav should highlight the current active route.
- The reading view (`/read/[chunkId]`) should hide the nav bar to avoid distracting from the reading experience — it has its own bottom action bar.

**Implementation approach:**
1. Create a new component at `src/app/_components/nav-bar.tsx`
2. Add it to `src/app/layout.tsx` (the root layout)
3. The reading view at `src/app/read/[chunkId]/layout.tsx` should opt out of showing the nav — use a CSS approach or a separate layout group
4. Use Lucide icons (already in the project) for the tab bar: `Home`, `BarChart3`, `Settings`
5. Use `usePathname()` from `next/navigation` to highlight the active tab

**Remove existing ad-hoc navigation** from individual pages where it conflicts with the new global nav. Keep "Back to Book" links on detail pages where they serve as hierarchical breadcrumbs, not primary navigation.

### Acceptance Criteria

- [ ] A bottom tab bar appears on mobile with Library, Stats, and Settings tabs
- [ ] A top navigation bar appears on desktop with the same links
- [ ] The current page's tab/link is visually highlighted
- [ ] The nav bar is hidden on the reading view (`/read/[chunkId]`)
- [ ] The bottom tab bar does not overlap page content (proper padding/margin on the body)
- [ ] The nav bar works in both light and dark mode
- [ ] Icons are clear and recognizable at mobile sizes
- [ ] Bottom tab bar respects safe area insets (after Task 5 is done)

### Files to Create/Edit

- **Create:** `src/app/_components/nav-bar.tsx`
- **Edit:** `src/app/layout.tsx` — add the nav component
- **Edit:** `src/app/read/[chunkId]/layout.tsx` — ensure nav is hidden here
- **Edit:** Various pages to remove conflicting ad-hoc navigation links

### How to Test

**Code review:**
- Verify the component uses `usePathname()` for active state
- Verify mobile breakpoint uses `fixed bottom-0` positioning
- Verify desktop breakpoint uses a top bar
- Check that `pb-[env(safe-area-inset-bottom)]` or equivalent is applied (if Task 5 is complete)
- Check that the body/main content has bottom padding to account for the fixed bar (e.g., `pb-16 md:pb-0`)

**Visual:**
- Resize browser to mobile width (~375px): bottom tab bar should appear
- Resize to desktop (~1024px): top nav should appear
- Navigate between Library, Stats, Settings: active state should update
- Go to `/read/[chunkId]`: nav should be hidden

**Playwright:**
- Add a navigation test file `e2e/navigation/nav.spec.ts`:
  ```ts
  test('mobile bottom nav is visible and functional', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    // Verify 3 links
    await expect(nav.getByRole('link')).toHaveCount(3);
    // Click Stats and verify navigation
    await nav.getByRole('link', { name: /stats/i }).click();
    await expect(page).toHaveURL('/stats');
  });

  test('nav is hidden on reading view', async ({ page }) => {
    // Navigate to a reading view (requires a book with chunks)
    await page.goto('/read/CHUNK_ID');
    const bottomNav = page.locator('nav[data-testid="bottom-nav"]');
    await expect(bottomNav).not.toBeVisible();
  });
  ```

---

## Task 4: Add PWA Support

**Priority:** Critical
**Effort:** Small

### Context

The app has no Progressive Web App support. For a daily reading app that users visit every morning, being installable on the home screen is essential. Currently there's no manifest, no apple-mobile-web-app meta tags, and no theme-color.

### What to Change

1. **Create `public/manifest.json`:**
   ```json
   {
     "name": "Micro Reads",
     "short_name": "MicroReads",
     "description": "Daily bite-sized reading from your epub library",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#FAFAF7",
     "theme_color": "#FAFAF7",
     "icons": [
       {
         "src": "/icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/icon-512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

2. **Generate app icons:** Create 192x192 and 512x512 PNG icons from the existing `src/app/icon.svg` (book-themed SVG). Also create a 180x180 `apple-touch-icon.png`.

3. **Update `src/app/layout.tsx` metadata:**
   - Add manifest link
   - Add `apple-mobile-web-app-capable` meta tag
   - Add `apple-mobile-web-app-status-bar-style` (set to `default` for light mode)
   - Add `theme_color` (Next.js metadata API supports this)

   In the Next.js metadata export:
   ```ts
   export const metadata: Metadata = {
     title: "Micro Reads",
     description: "Daily bite-sized reading from your epub library",
     manifest: "/manifest.json",
     appleWebApp: {
       capable: true,
       statusBarStyle: "default",
       title: "Micro Reads",
     },
     other: {
       "mobile-web-app-capable": "yes",
     },
   };

   export const viewport: Viewport = {
     themeColor: "#FAFAF7",
   };
   ```

### Acceptance Criteria

- [ ] `public/manifest.json` exists with correct fields
- [ ] App icons exist at 192x192, 512x512, and 180x180 (apple-touch-icon)
- [ ] `<link rel="manifest" href="/manifest.json">` is in the rendered HTML head
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes">` is present
- [ ] `<meta name="theme-color" content="#FAFAF7">` is present
- [ ] On iOS Safari, "Add to Home Screen" shows the app name and icon
- [ ] When opened from the home screen, the app runs in standalone mode (no browser chrome)
- [ ] The status bar blends with the app background color

### Files to Create/Edit

- **Create:** `public/manifest.json`
- **Create:** `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
- **Edit:** `src/app/layout.tsx` — update metadata export

### How to Test

**Code review:**
- Verify `manifest.json` has `"display": "standalone"` and correct colors
- Verify `layout.tsx` exports metadata with `manifest`, `appleWebApp`, and theme color
- Verify icon files exist and are correctly sized

**Visual (dev server):**
- Open Chrome DevTools → Application → Manifest: verify manifest loads and shows correct data
- Check the "Installability" section in Lighthouse for PWA compliance

**Playwright:**
- Check that manifest link is in the head:
  ```ts
  test('PWA manifest is linked', async ({ page }) => {
    await page.goto('/');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', '/manifest.json');
  });

  test('apple-mobile-web-app-capable is set', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(meta).toHaveAttribute('content', 'yes');
  });

  test('theme-color is set', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="theme-color"]');
    await expect(meta).toHaveAttribute('content', '#FAFAF7');
  });
  ```

---

## Task 5: Add Safe Area Inset Handling

**Priority:** Critical
**Effort:** Small

### Context

No safe area handling exists in the codebase. On iPhones with a notch/Dynamic Island/home indicator, fixed bottom elements (like the reading view action bar and the new bottom nav from Task 3) will be obscured by the home gesture area.

### What to Change

1. **Update viewport meta in `src/app/layout.tsx`:**
   Add `viewport-fit=cover` to the viewport configuration. In Next.js 14+, export a `viewport` object:
   ```ts
   import type { Viewport } from 'next';

   export const viewport: Viewport = {
     themeColor: "#FAFAF7",
     viewportFit: "cover",
   };
   ```
   If a `viewport` export already exists (from Task 4), merge `viewportFit: "cover"` into it.

2. **Add safe area padding to fixed bottom elements:**
   - `src/app/read/[chunkId]/_components/reading-actions.tsx` — the fixed bottom action bar. Add `pb-[env(safe-area-inset-bottom)]` to the outermost container.
   - `src/app/_components/nav-bar.tsx` (from Task 3) — add `pb-[env(safe-area-inset-bottom)]` to the mobile bottom tab bar.

3. **Add safe area utility to `src/app/globals.css`:**
   ```css
   .safe-area-bottom {
     padding-bottom: env(safe-area-inset-bottom, 0px);
   }
   ```
   Or use Tailwind arbitrary values directly: `pb-[env(safe-area-inset-bottom)]`.

### Acceptance Criteria

- [ ] The rendered `<meta name="viewport">` includes `viewport-fit=cover`
- [ ] The reading view bottom action bar has padding that accounts for the home indicator
- [ ] The mobile nav bar (Task 3) has safe area bottom padding
- [ ] On devices without a home indicator, the padding is 0 (no extra space)
- [ ] Content does not get hidden behind the status bar at the top

### Files to Edit

- `src/app/layout.tsx` — viewport export
- `src/app/read/[chunkId]/_components/reading-actions.tsx` — bottom bar padding
- `src/app/_components/nav-bar.tsx` — bottom nav padding (if Task 3 is complete)
- Optionally `src/app/globals.css` — utility class

### How to Test

**Code review:**
- Grep for `viewport-fit` in `layout.tsx` and confirm it's set to `cover`
- Grep for `safe-area-inset` in the reading actions and nav bar components
- Verify the `env()` function is used with a fallback: `env(safe-area-inset-bottom, 0px)`

**Visual:**
- In Chrome DevTools, use the device emulator with an iPhone 14 Pro preset
- The bottom bar should not overlap the home indicator area
- On a non-notched device (or desktop), there should be no extra padding

**Playwright:**
- Verify the viewport meta tag:
  ```ts
  test('viewport includes viewport-fit=cover', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('meta[name="viewport"]');
    const content = await viewport.getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });
  ```
- Verify safe-area classes are present on the reading action bar:
  ```ts
  test('reading action bar has safe area padding', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const actionBar = page.locator('[data-testid="reading-actions"]');
    const classes = await actionBar.getAttribute('class');
    // Check for safe-area-related class or inline style
    expect(classes).toMatch(/safe-area|env\(safe-area/);
  });
  ```

---

## Task 6: Fix Touch Target Sizes

**Priority:** High
**Effort:** Small-Medium

### Context

Apple HIG requires 44x44pt minimum tap targets; Material Design requires 48x48dp. Several interactive elements fall below these thresholds, making them frustrating to use on mobile.

### What to Change

**6a. Book control action pills** (`src/app/book/[bookId]/_components/book-controls.tsx`, line ~82):
- Current: Small pill badges styled like tags (e.g., `px-3 py-1.5 text-sm`)
- Fix: Increase to `px-4 py-2.5 text-sm` minimum. Add `min-h-[44px]` to ensure touch target.
- These should look like proper buttons, not tags.

**6b. Chunk grid squares** (`src/app/book/[bookId]/_components/chunk-grid.tsx`, line ~52):
- Current: Tiny numbered boxes (~24-28px each)
- Fix: On mobile, switch to a chapter-level progress view instead of individual chunk squares. Use a media query or Tailwind `md:` prefix — show chapter-grouped progress bars on mobile (`< md`), keep the detailed grid on desktop (`>= md`).
- If keeping the grid on mobile, increase each square to at least `min-w-[44px] min-h-[44px]`.

**6c. Chunk size +/- buttons** (`src/app/book/[bookId]/_components/chunk-size-control.tsx`, lines ~43-77):
- Current: Small increment/decrement controls
- Fix: Add `min-w-[44px] min-h-[44px]` and ensure the tap target includes padding around the icon.

**6d. Reading view "Mark Read & Next" button** (`src/app/read/[chunkId]/_components/reading-actions.tsx`):
- Current: Borderline size for a primary action
- Fix: Increase to `py-3` minimum height. This is the most important action in the app — make it a generous tap target.

**6e. Settings time picker** (`src/app/settings/page.tsx`):
- Current: Small select dropdowns
- Fix: Add `min-h-[44px]` and increase font size to at least `text-base` on mobile.

**6f. Upload slider** (`src/app/upload/page.tsx`):
- Current: Thin slider track
- Fix: The shadcn slider component may need its track height increased. Check if there's a `h-2` class on the track and increase to `h-3` or `h-4`. Ensure the thumb is at least 44px.

### Acceptance Criteria

- [ ] All interactive elements have a minimum tappable area of 44x44px
- [ ] Book control buttons look like proper buttons, not small tags
- [ ] Chunk grid is usable on a phone screen (either larger squares or a mobile-specific view)
- [ ] The "Mark Read & Next" button is generously sized as the primary action
- [ ] Time picker selects are comfortably tappable on mobile
- [ ] Slider thumb is easy to grab on touchscreens

### Files to Edit

- `src/app/book/[bookId]/_components/book-controls.tsx`
- `src/app/book/[bookId]/_components/chunk-grid.tsx`
- `src/app/book/[bookId]/_components/chunk-size-control.tsx`
- `src/app/read/[chunkId]/_components/reading-actions.tsx`
- `src/app/settings/page.tsx`
- `src/app/upload/page.tsx`

### How to Test

**Code review:**
- Check that all buttons/links have `min-h-[44px]` or equivalent padding that results in >= 44px height
- Verify no interactive element uses only `text-xs` sizing without padding compensation

**Visual:**
- Use Chrome DevTools mobile emulation (iPhone SE 375px width)
- Try tapping each interactive element — there should be no difficulty hitting the target
- Pay special attention to the chunk grid and book control pills

**Playwright:**
- Measure element bounding boxes at mobile viewport:
  ```ts
  test('touch targets meet 44px minimum', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/book/BOOK_ID');

    const buttons = page.locator('[data-testid="book-controls"] button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
  ```

---

## Task 7: Reading View Typography & Cover Image

**Priority:** High
**Effort:** Small-Medium

### Context

The reading view is the most important page in the app. The cover image dominates the viewport pushing text below the fold. On mobile, text runs nearly edge-to-edge. The line-height and max-width need tuning per the spec.

### What to Change

**7a. Cover image sizing** (`src/app/read/[chunkId]/page.tsx`):
- Constrain cover images: add `max-h-[40vh] w-auto object-contain mx-auto` to the cover `<img>` element
- Add a subtle divider or spacing between the cover and reading text
- Consider hiding the cover entirely on the reading view (it's already on the book detail page) — or show it much smaller as a header element

**7b. Reading column width** (`src/app/globals.css` or inline on the reading view):
- The `.prose-reader` class or the reading container should have `max-width: 65ch` (the spec says ~60ch, use 65ch for slight breathing room)
- Center the column: `mx-auto`

**7c. Line height** (`src/app/globals.css`):
- The `.prose-reader` class already sets `line-height: 1.75` — verify this is actually applied and not overridden
- If it's set to a lower value, change it to `1.75`

**7d. Mobile padding** (`src/app/read/[chunkId]/page.tsx` or `.prose-reader`):
- Add horizontal padding of at least `px-5` (1.25rem / 20px) on mobile
- On desktop this can be less since the `max-width: 65ch` already constrains the column

**7e. Dark mode cover images:**
- Floating covers on dark backgrounds look disjointed
- Add a subtle border or rounded corners: `rounded-lg border border-border` in dark mode

### Acceptance Criteria

- [ ] Cover image does not fill the entire viewport — text content is visible above the fold on mobile
- [ ] Reading column is no wider than ~65 characters
- [ ] Line height is 1.75 in the reading view
- [ ] On a 375px mobile screen, text has at least 20px of padding on each side
- [ ] In dark mode, cover images have a visible border or subtle container
- [ ] The reading experience feels premium and book-like

### Files to Edit

- `src/app/read/[chunkId]/page.tsx` — cover image and layout
- `src/app/globals.css` — `.prose-reader` styles (verify/fix)

### How to Test

**Code review:**
- Check the cover `<img>` tag for `max-h` constraints
- Check `.prose-reader` in `globals.css` for `line-height: 1.75` and `max-width: 65ch`
- Check for horizontal padding (px-5 or equivalent) on the reading container

**Visual:**
- Navigate to a reading view at 375px width: text should not touch screen edges
- At 1440px desktop: text column should be ~65ch wide, centered
- The cover should be visible but not dominate — text starts within the first scroll

**Playwright:**
  ```ts
  test('reading view typography', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/read/CHUNK_ID');
    const prose = page.locator('.prose-reader');
    const box = await prose.boundingBox();
    // Verify padding: content should not start at x=0
    expect(box!.x).toBeGreaterThanOrEqual(16); // At least 16px left padding
  });

  test('cover image is constrained', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const cover = page.locator('img[alt*="cover" i]');
    if (await cover.count() > 0) {
      const box = await cover.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.height).toBeLessThan(viewport.height * 0.5);
    }
  });
  ```

---

## Task 8: Library Responsive Grid & Title Truncation

**Priority:** High
**Effort:** Small

### Context

On desktop, the library page shows a single ~350px book card floating in a 1440px viewport — sparse and unfinished looking. Book titles truncate even when there's plenty of space. Mobile works well already.

### What to Change

**8a. Responsive grid** (`src/app/page.tsx`):
- Wrap book cards in a CSS grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Or use auto-fill: `grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4`
- Cards should fill the available width in their grid cell

**8b. Title truncation:**
- Find the book title element in the card component and remove `truncate` or `line-clamp-1`
- Allow the title to wrap to multiple lines
- Optionally use `line-clamp-2` if 2 lines is enough, or let it wrap fully

### Acceptance Criteria

- [ ] On desktop (>= 1024px), book cards arrange in a 2-3 column grid
- [ ] On mobile (< 768px), cards remain single-column and full-width
- [ ] Book titles wrap instead of truncating when there's space
- [ ] The library page looks intentionally designed, not sparse, at desktop widths
- [ ] The grid handles 1 book gracefully (doesn't stretch it to 100% width)

### Files to Edit

- `src/app/page.tsx` — the library page container and book card rendering

### How to Test

**Code review:**
- Check for `grid` or `flex` container classes on the book list
- Check for `truncate` / `line-clamp` on book title elements and verify they're removed or relaxed

**Visual:**
- At 1440px: cards should be in 2-3 columns, titles should not truncate
- At 375px: cards should be full-width, stacked vertically
- With 1 book: should not look broken (card at reasonable width, not 100%)

**Playwright:**
  ```ts
  test('library grid is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const cards = page.locator('[data-testid="book-card"]'); // adjust selector
    if (await cards.count() >= 2) {
      const first = await cards.first().boundingBox();
      const second = await cards.nth(1).boundingBox();
      // On desktop, cards should be side by side (same y, different x)
      expect(first!.y).toBeCloseTo(second!.y, 1);
      expect(first!.x).not.toEqual(second!.x);
    }
  });

  test('book titles do not truncate on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const title = page.locator('[data-testid="book-title"]').first();
    // Check that text is not truncated (no ellipsis in computed style)
    const overflow = await title.evaluate(el =>
      getComputedStyle(el).textOverflow
    );
    expect(overflow).not.toBe('ellipsis');
  });
  ```

---

## Task 9: Make Progress Bars Visible

**Priority:** High
**Effort:** Small

### Context

The progress bar on library book cards is nearly invisible — a thin line with almost no contrast against the card background. It needs a visible track and more height.

### What to Change

- Find the progress bar component used on library book cards (likely in `src/app/page.tsx` or a card sub-component)
- Add a **visible track background**: `bg-muted` or `bg-gray-200 dark:bg-gray-700`
- Increase the bar **height** to at least 4px: change `h-1` to `h-1.5` or `h-2`
- Ensure the **fill color** has good contrast against the track: use the green accent (`bg-emerald-500`)
- Add `rounded-full` to both the track and the fill for a polished look

### Acceptance Criteria

- [ ] The progress bar track (background) is clearly visible on both light and dark mode
- [ ] The fill bar is at least 4px tall
- [ ] The fill color contrasts against the track
- [ ] Both track and fill have rounded ends
- [ ] At 0% progress, the track is still visible (shows empty state)
- [ ] At 100% progress, the bar fills completely

### Files to Edit

- `src/app/page.tsx` (or wherever the book card progress bar is rendered)
- Possibly a shared Progress component from shadcn/ui — check `src/components/ui/progress.tsx`

### How to Test

**Code review:**
- Check the progress bar element for `h-` height classes (should be `h-1.5` or `h-2`)
- Check for a background color on the track wrapper
- Check that the fill uses a distinct color (not the same as the track)

**Visual:**
- On the library page, the progress bar should be clearly visible at a glance
- Test at 0%, ~50%, and 100% progress values

**Playwright:**
  ```ts
  test('progress bar is visible', async ({ page }) => {
    await page.goto('/');
    const progressTrack = page.locator('[role="progressbar"]').first();
    if (await progressTrack.count() > 0) {
      const box = await progressTrack.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(4);
    }
  });
  ```

---

## Task 10: Standardize Button Hierarchy

**Priority:** High
**Effort:** Medium

### Context

Buttons across the app use too many inconsistent styles: filled dark ("Upload Book"), filled green ("Mark Read & Next"), small colored outline pills (book detail actions), full-width dark ("Save Settings"), outline ("Send Digest"). This creates a confusing visual language.

### What to Change

Establish and apply 3 button tiers consistently across all pages:

| Tier | Style | Usage |
| ---- | ----- | ----- |
| **Primary** | Filled with accent color, white text | Main actions: "Upload Book", "Mark Read & Next", "Save Settings", "Add to Active" |
| **Secondary** | Outline border, text color matches border | Supporting actions: "Back to Book", "Send Test Email", "Add to Queue" |
| **Destructive** | Red fill or red outline | Dangerous actions: "Delete Book" |

**Pages to update:**
- **Library header** (`src/app/page.tsx`): "Upload Book" → Primary
- **Upload** (`src/app/upload/page.tsx`): "Add to Active" → Primary, "Add to Queue" → Secondary
- **Reading view** (`src/app/read/[chunkId]/_components/reading-actions.tsx`): "Mark Read & Next" → Primary, "Back to Book" → Secondary
- **Book detail** (`src/app/book/[bookId]/_components/book-controls.tsx`): "Delete Book" → Destructive, others → Secondary
- **Settings** (`src/app/settings/page.tsx`): "Save Settings" → Primary (not full-width, right-aligned), "Send Digest" / "Send Test Email" → Secondary

Use shadcn/ui's existing button variants (`default`, `outline`, `destructive`, `ghost`) and apply them consistently. Avoid custom one-off button styles.

### Acceptance Criteria

- [ ] All primary actions across the app use the same filled button style
- [ ] All secondary actions use the same outline button style
- [ ] Destructive actions use red styling
- [ ] No more than 3 button visual styles exist in the entire app
- [ ] Buttons look correct in both light and dark mode
- [ ] "Save Settings" is not full-width — right-aligned or auto-width

### Files to Edit

- `src/app/page.tsx`
- `src/app/upload/page.tsx`
- `src/app/read/[chunkId]/_components/reading-actions.tsx`
- `src/app/book/[bookId]/_components/book-controls.tsx`
- `src/app/settings/page.tsx`

### How to Test

**Code review:**
- Grep for `<Button` or `<button` across all pages
- Verify each uses a shadcn variant: `variant="default"` (primary), `variant="outline"` (secondary), `variant="destructive"`
- Check that no custom bg/border classes override the variants

**Visual:**
- Visit every page and verify button styling is consistent
- Primary buttons should all look the same across pages
- Dark mode buttons should maintain contrast

**Playwright:**
- Visual regression: screenshot each page and compare before/after
- Verify buttons have correct variant attributes:
  ```ts
  test('reading view uses correct button variants', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const primary = page.getByRole('button', { name: /mark read/i });
    const secondary = page.getByRole('link', { name: /back to book/i });
    // Primary should not be outline variant
    await expect(primary).not.toHaveClass(/variant-outline/);
  });
  ```

---

## Task 11: Add Proper Input Attributes for Mobile Keyboards

**Priority:** Medium
**Effort:** Small

### Context

Form inputs are missing `inputMode`, `autocomplete`, and optimal `type` attributes. This means mobile users don't get the best keyboard for each field — e.g., no email keyboard for email fields, no password manager integration.

### What to Change

| Input | File | Attributes to Add |
| ----- | ---- | ----------------- |
| Password field | `src/app/login/page.tsx` | `type="password"` (verify), `autocomplete="current-password"` |
| Email field | `src/app/settings/page.tsx` | `type="email"`, `inputMode="email"`, `autocomplete="email"` |
| Chunk size input | `src/app/book/[bookId]/_components/chunk-size-control.tsx` | `inputMode="numeric"`, `pattern="[0-9]*"` |
| Time picker selects | `src/app/settings/page.tsx` | Ensure `<select>` elements are large enough to tap (see Task 6e) |

### Acceptance Criteria

- [ ] The login password field triggers the password keyboard and password manager on mobile
- [ ] The settings email field triggers the email keyboard (with @ symbol)
- [ ] Numeric inputs trigger the number pad on mobile
- [ ] All inputs have appropriate `autocomplete` hints

### Files to Edit

- `src/app/login/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/book/[bookId]/_components/chunk-size-control.tsx`

### How to Test

**Code review:**
- Check each `<input>` or `<Input>` component for the required attributes
- Grep: `grep -n "Input\|<input" src/app/login/page.tsx src/app/settings/page.tsx src/app/book/\[bookId\]/_components/chunk-size-control.tsx`

**Playwright:**
  ```ts
  test('login password field has autocomplete', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('input[type="password"]');
    await expect(input).toHaveAttribute('autocomplete', 'current-password');
  });

  test('settings email field has correct inputMode', async ({ page }) => {
    await page.goto('/settings');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('inputMode', 'email');
  });
  ```

---

## Task 12: Fix Heatmap Overflow on Mobile

**Priority:** Medium
**Effort:** Small-Medium

### Context

The GitHub-style heatmap calendar on the stats page overflows horizontally on screens narrower than ~400px, causing the entire page to scroll horizontally.

### What to Change

Two approaches (pick one):

**Option A: Contained horizontal scroll (simpler):**
- Wrap the heatmap in a container with `overflow-x-auto` and prevent the parent from scrolling horizontally
- Add visual indicators (gradient fade on edges) to hint that it scrolls
- The page body should never scroll horizontally

**Option B: Mobile-specific layout (better UX):**
- On mobile (`< md`), replace the horizontal heatmap with a vertical month-by-month layout
- Show the last 3 months stacked vertically, each as a small grid
- Keep the full horizontal heatmap on desktop

### Acceptance Criteria

- [ ] The stats page never causes horizontal page scroll on a 375px viewport
- [ ] The heatmap data is still accessible on mobile (either scrollable or reformatted)
- [ ] No content is clipped without a way to access it
- [ ] Desktop heatmap remains unchanged

### Files to Edit

- `src/app/stats/page.tsx` — heatmap rendering section

### How to Test

**Code review:**
- Check for `overflow-x-auto` on the heatmap wrapper
- Verify the page body / main container does not have `overflow-x: visible`

**Visual:**
- At 375px width, scroll right — the page should not scroll horizontally
- The heatmap should either be in a scrollable container or reformatted

**Playwright:**
  ```ts
  test('no horizontal overflow on stats page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stats');
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
  ```

---

## Task 13: Add Overscroll Behavior to Reading View

**Priority:** Medium
**Effort:** Small

### Context

On mobile browsers, pull-to-refresh can activate while the user is scrolling through reading content. This interrupts the reading experience and reloads the page.

### What to Change

Add `overscroll-behavior-y: contain` to the reading view's scroll container to prevent the browser's pull-to-refresh from triggering.

Either:
- Add it to the reading view layout at `src/app/read/[chunkId]/layout.tsx` on the body or main container
- Or add a utility class in `src/app/globals.css` and apply it to the reading view page

### Acceptance Criteria

- [ ] Pull-to-refresh does not trigger while scrolling in the reading view
- [ ] Normal scrolling behavior is unaffected
- [ ] Other pages are not affected (pull-to-refresh may still work on library, stats, etc.)

### Files to Edit

- `src/app/read/[chunkId]/layout.tsx` or `src/app/read/[chunkId]/page.tsx`
- Optionally `src/app/globals.css`

### How to Test

**Code review:**
- Grep for `overscroll-behavior` in the reading view files
- Verify it's `contain` (not `none`, which would also prevent momentum scrolling)

**Playwright:**
  ```ts
  test('reading view has overscroll-behavior-y contain', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const overscroll = await page.evaluate(() => {
      const el = document.querySelector('main') || document.body;
      return getComputedStyle(el).overscrollBehaviorY;
    });
    expect(overscroll).toBe('contain');
  });
  ```

---

## Task 14: Responsive Cover Images

**Priority:** Medium
**Effort:** Small

### Context

Cover images render at natural size without constraints. On mobile, a tall cover fills the entire viewport. Images are not lazy-loaded. The same full-size image is served to all devices.

### What to Change

**14a. Constrain cover images:**
- Reading view (`src/app/read/[chunkId]/page.tsx`): `max-h-[40vh] w-auto object-contain`
- Library cards (`src/app/page.tsx`): covers should have fixed dimensions in the card thumbnail
- Book detail (`src/app/book/[bookId]/page.tsx`): constrain to reasonable size

**14b. Add lazy loading:**
- Add `loading="lazy"` to all cover images that are not above the fold
- Library card covers below the first viewport should be lazy-loaded
- Book detail cover can be eager (it's above the fold)

**14c. Consider Next.js Image component:**
- If not already using `next/image`, consider switching cover images to use it for automatic WebP conversion and responsive `srcset`
- This requires the images to be served from the app's domain (which they are — from `/covers/`)

### Acceptance Criteria

- [ ] No cover image is taller than 40% of the viewport in the reading view
- [ ] Images below the fold use `loading="lazy"`
- [ ] Cover images look sharp but are not oversized on mobile
- [ ] Dark mode: cover images have a subtle border (not floating on dark background)

### Files to Edit

- `src/app/read/[chunkId]/page.tsx`
- `src/app/page.tsx`
- `src/app/book/[bookId]/page.tsx`

### How to Test

**Code review:**
- Check all `<img>` tags for `max-h`, `loading`, and `object-contain` attributes
- Check for `next/image` usage

**Playwright:**
  ```ts
  test('cover image is height-constrained in reading view', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const img = page.locator('img').first();
    const imgBox = await img.boundingBox();
    const viewport = page.viewportSize()!;
    if (imgBox) {
      expect(imgBox.height).toBeLessThanOrEqual(viewport.height * 0.5);
    }
  });
  ```

---

## Task 15: Verify Serif Webfont Loading

**Priority:** Medium
**Effort:** Small

### Context

The spec calls for Literata or Source Serif Pro for reading typography. The app loads Source Serif 4 via `next/font/google` in `layout.tsx` with `display: "swap"`. Need to verify it's actually being applied and not falling back to Georgia.

### What to Change

1. **Verify the font loads:** Check that `--font-serif` CSS variable is set and the `.prose-reader` class uses `font-family: var(--font-serif)`.
2. **Check the CSS chain:** In `globals.css`, the `.prose-reader` already sets `font-family: var(--font-serif), Georgia, "Times New Roman", Times, serif` — this is correct. But verify the variable resolves to the loaded Source Serif 4 font.
3. **If the font isn't loading:** Check that the `sourceSerif.variable` class is applied to the `<body>` in `layout.tsx` (it is currently).

This may already be working correctly — the task is to **verify** and fix only if needed.

### Acceptance Criteria

- [ ] Source Serif 4 is loading from Google Fonts (check Network tab)
- [ ] The reading view text renders in Source Serif 4, not Georgia
- [ ] The `--font-serif` CSS variable resolves to the correct font family
- [ ] `display: swap` is set (it is) so text appears immediately with fallback, then swaps

### Files to Check

- `src/app/layout.tsx` — font import and variable assignment
- `src/app/globals.css` — `.prose-reader` font-family declaration

### How to Test

**Code review:**
- Verify `Source_Serif_4` import in layout.tsx
- Verify `sourceSerif.variable` is in the body className
- Verify `.prose-reader` uses `var(--font-serif)` as its font-family

**Visual:**
- Open reading view in Chrome DevTools → Elements → Computed styles → font-family
- It should show `Source Serif 4` as the rendered font, not Georgia
- Check Network tab: a Google Fonts CSS request should load the font files

**Playwright:**
  ```ts
  test('reading view uses Source Serif 4', async ({ page }) => {
    await page.goto('/read/CHUNK_ID');
    const fontFamily = await page.evaluate(() => {
      const el = document.querySelector('.prose-reader');
      return el ? getComputedStyle(el).fontFamily : '';
    });
    expect(fontFamily.toLowerCase()).toContain('source serif');
  });
  ```

---

## Task 16: Simplify Chunk Grid on Mobile

**Priority:** Medium
**Effort:** Medium

### Context

The book detail page shows a grid of individually numbered chunk squares. With 200+ chunks, this creates a wall of tiny boxes that's overwhelming on desktop and unusable on mobile.

### What to Change

- **Mobile (< md):** Replace the chunk grid with a **chapter-level progress view**. Show each chapter as a row with: chapter title/number, progress bar, "X/Y chunks read" text. Tappable to expand or navigate.
- **Desktop (>= md):** Keep the grid but group by chapter with collapsible sections. Each chapter section shows its chunk squares with a chapter header. Collapsed by default for chapters that are fully read.
- Use Tailwind responsive classes (`hidden md:block` / `md:hidden`) to switch between views.

### Acceptance Criteria

- [ ] On mobile, the chunk grid is replaced with a chapter-based progress list
- [ ] Each chapter shows its progress clearly (bar + text like "5/12 read")
- [ ] On desktop, the grid is organized by chapter with headers
- [ ] Read chapters can be collapsed to reduce visual noise
- [ ] The total chunk count is still visible somewhere
- [ ] Navigation to specific chunks is still possible from both views

### Files to Edit

- `src/app/book/[bookId]/_components/chunk-grid.tsx` — major refactor
- `src/app/book/[bookId]/page.tsx` — may need to pass chapter grouping data

### How to Test

**Visual:**
- At 375px: chapter progress list should be visible, no tiny grid
- At 1024px: grouped grid with chapter headers
- Test with a book that has 200+ chunks — should not feel overwhelming on either viewport

**Playwright:**
  ```ts
  test('mobile shows chapter progress view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/book/BOOK_ID');
    // Chunk grid squares should not be visible
    const chunkSquares = page.locator('[data-testid="chunk-square"]');
    await expect(chunkSquares.first()).not.toBeVisible();
    // Chapter progress should be visible
    const chapterProgress = page.locator('[data-testid="chapter-progress"]');
    await expect(chapterProgress.first()).toBeVisible();
  });
  ```

---

## Task 17: Add Hover/Focus States

**Priority:** Medium
**Effort:** Small

### Context

Interactive elements lack visual feedback. Book cards don't lift on hover. Buttons don't have focus rings for keyboard accessibility. Focus states are important for both mouse and keyboard users.

### What to Change

- **Book cards** (`src/app/page.tsx`): Add `hover:shadow-md hover:-translate-y-0.5 transition-all duration-200` for a subtle lift on hover
- **All buttons:** Ensure shadcn/ui's default focus ring is not suppressed. Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` if missing
- **Chunk grid squares** (`src/app/book/[bookId]/_components/chunk-grid.tsx`): Add `hover:scale-110 transition-transform` for feedback
- **Nav links** (from Task 3): Add hover underline or background highlight

### Acceptance Criteria

- [ ] Book cards lift with a subtle shadow on hover
- [ ] All buttons show a visible focus ring when focused via keyboard (Tab key)
- [ ] Interactive elements have hover states
- [ ] Transitions are smooth (200ms duration)
- [ ] Focus states are accessible (visible at WCAG AA)

### Files to Edit

- `src/app/page.tsx` — book cards
- `src/app/book/[bookId]/_components/chunk-grid.tsx` — grid squares
- Any button components missing focus states

### How to Test

**Code review:**
- Grep for `hover:` classes on interactive elements
- Grep for `focus-visible:` ring classes on buttons
- Check for `transition` classes

**Visual:**
- Tab through the library page: cards and buttons should show focus rings
- Hover over cards: they should lift slightly

**Playwright:**
  ```ts
  test('book cards have hover styles', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="book-card"]').first();
    await card.hover();
    const transform = await card.evaluate(el =>
      getComputedStyle(el).transform
    );
    // Should have some transform applied (translateY)
    expect(transform).not.toBe('none');
  });
  ```

---

## Task 18: Fix Settings Page Spacing & Button Alignment

**Priority:** Medium
**Effort:** Small

### Context

The settings page has inconsistent spacing between card sections. The "Save Settings" button is a full-width dark button that's visually heavy.

### What to Change

- **Even spacing:** Ensure all card sections (Email Delivery, AI Configuration, Actions) use the same `gap` or `space-y` value. Use `space-y-6` between sections.
- **Save button:** Change from full-width to auto-width, right-aligned. Use `flex justify-end` on the button wrapper. Apply the Primary button style (from Task 10).
- **Dark mode button:** After Task 1's dark mode fixes, verify the button is visible. If not, explicitly use `variant="default"` which should now invert properly.

### Acceptance Criteria

- [ ] Equal spacing between all settings sections
- [ ] "Save Settings" button is right-aligned, not full-width
- [ ] Button has good contrast in both light and dark mode
- [ ] "Send Digest" and "Send Test Email" remain as secondary buttons (outline style)

### Files to Edit

- `src/app/settings/page.tsx`

### How to Test

**Code review:**
- Check the container's spacing classes (`space-y-*` or `gap-*`)
- Check the save button wrapper for `flex justify-end`
- Check the button is not `w-full`

**Visual:**
- Settings page should have even visual rhythm between sections
- Save button should be on the right, proportionally sized

---

## Task 19: Improve Upload Disabled Button Distinction

**Priority:** Medium
**Effort:** Small

### Context

The "Add to Active" and "Add to Queue" buttons look identical when disabled (both gray). Users can't tell which is the primary action or that they're in a disabled state.

### What to Change

- Apply `disabled:opacity-50 disabled:cursor-not-allowed` to disabled buttons
- The primary button ("Add to Active") should use the Primary style from Task 10 when enabled, and clearly dim when disabled
- The secondary button ("Add to Queue") should use outline style when enabled
- When a file is selected, the contrast between enabled and disabled should be obvious

### Acceptance Criteria

- [ ] Disabled buttons are visually distinct (lower opacity, not-allowed cursor)
- [ ] The primary action is clearly distinguishable from the secondary action
- [ ] When a file is selected and buttons become enabled, the change is obvious
- [ ] Both light and dark mode handle disabled states correctly

### Files to Edit

- `src/app/upload/page.tsx`

### How to Test

**Code review:**
- Check disabled button classes include `disabled:opacity-50`
- Check the two buttons use different variants (primary vs outline)

**Visual:**
- Visit `/upload` without selecting a file: buttons should look disabled
- Select a file: buttons should clearly activate

---

## Task 20: Add webkit-text-size-adjust

**Priority:** Medium
**Effort:** Small

### Context

Without `-webkit-text-size-adjust: 100%`, iOS Safari may auto-inflate font sizes when rotating from portrait to landscape, causing text to suddenly jump in size.

### What to Change

Add to `src/app/globals.css` in the base body styles:
```css
body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

If there's already a body rule, add the properties to it. If not, create one.

### Acceptance Criteria

- [ ] `-webkit-text-size-adjust: 100%` is set on the body
- [ ] Standard `text-size-adjust: 100%` is also set (for Firefox/other browsers)
- [ ] Text does not change size unexpectedly on orientation change

### Files to Edit

- `src/app/globals.css`

### How to Test

**Code review:**
- Grep for `text-size-adjust` in `globals.css`

**Playwright:**
  ```ts
  test('body has text-size-adjust', async ({ page }) => {
    await page.goto('/');
    const adjust = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('-webkit-text-size-adjust')
    );
    expect(adjust).toBe('100%');
  });
  ```

---

## Task 21: Add Page Transition Animations

**Priority:** Nice to Have
**Effort:** Medium

### Context

Page navigations are instant with no visual transition. Subtle animations between pages would make the app feel more polished and native-like.

### What to Change

- Add a simple fade-in animation on page mount using a shared layout wrapper
- Use CSS animations (the project already has `tw-animate-css`)
- Keep animations short (150-200ms) and subtle — this is a reading app, not a game
- Consider using Next.js `loading.tsx` convention for loading states between pages

### Acceptance Criteria

- [ ] Page content fades in on navigation (opacity 0 → 1, ~150ms)
- [ ] Animation does not block or delay content rendering
- [ ] Animation works in both light and dark mode
- [ ] Reading view transitions are especially smooth (no jarring content shifts)

### Files to Edit

- `src/app/layout.tsx` or a new `src/app/_components/page-transition.tsx`

---

## Task 22: Add Skeleton Loading States

**Priority:** Nice to Have
**Effort:** Medium

### Context

When loading data-heavy pages (book detail with 200+ chunks, stats with charts), there's no visual placeholder. Content pops in abruptly.

### What to Change

- Add skeleton components for: book detail chunk grid, stats cards, stats heatmap, library book cards
- Use shadcn/ui's Skeleton component (if available) or create simple pulsing placeholder divs
- Use Next.js `loading.tsx` files alongside each `page.tsx` for route-level loading states

### Acceptance Criteria

- [ ] Book detail page shows skeleton grid while chunks load
- [ ] Stats page shows skeleton cards and chart placeholders
- [ ] Skeletons match the approximate shape and size of real content
- [ ] Skeleton animation is smooth (pulse or shimmer)

### Files to Create

- `src/app/book/[bookId]/loading.tsx`
- `src/app/stats/loading.tsx`
- `src/app/loading.tsx` (library)

---

## Task 23: Add "Mark Read" Confirmation Microinteraction

**Priority:** Nice to Have
**Effort:** Small

### Context

The "Mark Read & Next" button is the primary action users perform every day. There's no satisfying feedback when it's pressed — the page just navigates.

### What to Change

- On click, briefly show a checkmark icon or green flash on the button before navigating (200-300ms)
- Or show a subtle toast/notification confirming the action
- The animation should not significantly delay navigation (keep it under 300ms)

### Acceptance Criteria

- [ ] Pressing "Mark Read & Next" provides visual confirmation before navigating
- [ ] The confirmation is brief and does not disrupt the flow
- [ ] Works in both light and dark mode

### Files to Edit

- `src/app/read/[chunkId]/_components/reading-actions.tsx`

---

## Task 24: Add Book Icon to Login Page

**Priority:** Nice to Have
**Effort:** Small

### Context

The library page has a book icon next to "Micro Reads" but the login page doesn't. Adding it would strengthen the brand.

### What to Change

- Add the same book icon (from Lucide or the library header) above or next to the "Micro Reads" heading on the login page
- Keep it appropriately sized — not overwhelming, just a visual anchor

### Acceptance Criteria

- [ ] The login page shows the book icon
- [ ] The icon matches the one used on the library page
- [ ] Works in both light and dark mode

### Files to Edit

- `src/app/login/page.tsx`

---

## Task 25: Optimize Landscape Reading Experience

**Priority:** Nice to Have
**Effort:** Small

### Context

Landscape orientation on mobile provides a wider viewport but less vertical space. The fixed bottom action bar may take up too much room.

### What to Change

- Test the reading view in landscape and evaluate
- If the bottom bar takes too much vertical space, consider reducing its height in landscape
- The 65ch max-width column should center well in landscape
- Consider using `@media (orientation: landscape)` if specific adjustments are needed

### Acceptance Criteria

- [ ] Reading view is comfortable in landscape orientation
- [ ] The bottom action bar doesn't consume too much vertical space
- [ ] Text column width remains readable

### Files to Edit

- `src/app/read/[chunkId]/page.tsx` or `reading-actions.tsx`

---

## Task 26: Virtualize Chunk Grid for Performance

**Priority:** Nice to Have
**Effort:** Medium

### Context

The chunk grid renders 200+ DOM elements for large books. On lower-end Android devices, this can cause scroll jank and slow initial render.

### What to Change

- If Task 16 (simplify chunk grid on mobile) is done, this may only be needed for the desktop grid
- Use a virtualization library (e.g., `@tanstack/react-virtual`) to only render visible chunks
- Or paginate the grid: show one chapter at a time with next/prev navigation

### Acceptance Criteria

- [ ] The chunk grid renders smoothly even with 500+ chunks
- [ ] Only visible chunks are in the DOM at any given time (if virtualized)
- [ ] Scrolling is smooth on a mid-range Android device
- [ ] Initial page load time is not impacted by chunk count

### Files to Edit

- `src/app/book/[bookId]/_components/chunk-grid.tsx`

# Bug Report: Reading View QA

## E2E Test Results

**4 failed, 5 passed** from `e2e/reading/read.spec.ts`:

| Test | Result | Reason |
|------|--------|--------|
| should display reading view for first chunk | PASS | |
| should not show Previous nav link on first chunk | PASS | Vacuously — no `<nav>` element exists at all |
| should show Next nav link on first chunk | **FAIL** | `<nav>` element removed |
| should navigate to next chunk | **FAIL** | `<nav>` "Next" link removed |
| should navigate back to previous chunk | **FAIL** | `<nav>` "Previous" link removed |
| should show End of book on last chunk | **FAIL** | "End of book" text removed |
| should show progress bar at bottom | PASS | |
| should mark chunk as read via API | PASS | |

---

## Bug 1: Last chunk button says "Mark Read & Next" when there is no next

**Severity:** Medium
**File:** `src/app/read/[chunkId]/_components/reading-actions.tsx:68`

The button always renders `"Mark Read & Next"` regardless of whether a next chunk exists. When `nextChunkId` is `null` (last chunk), clicking it marks the chunk read and navigates to the book detail page — but the label is misleading.

**Expected:** Button should say "Mark Read & Finish" or "Complete Book" on the last chunk.

**Root cause:** Line 68 has a single ternary for loading state but never checks `nextChunkId`:
```tsx
{loading ? "Saving..." : "Mark Read & Next"}
```

---

## Bug 2: No user-visible error feedback on mark-as-read failure

**Severity:** Medium
**File:** `src/app/read/[chunkId]/_components/reading-actions.tsx:39-41`

When the API call fails, the error is only logged to `console.error`. The button silently reverts to its default state. The user has no idea the operation failed.

**Root cause:**
```tsx
} catch (error) {
  console.error("Error marking chunk as read:", error);
  setLoading(false);
}
```

**Expected:** Show a toast or inline error message like "Failed to save progress. Try again."

---

## Bug 3: Skip-ahead reads don't advance progress or show as read

**Severity:** High
**File:** `src/app/api/chunks/[id]/read/route.ts:49`, `src/app/book/[bookId]/page.tsx:62-63,270`

**Steps to reproduce:**
1. With `currentChunkIndex` at 0, click chunk 6 from book detail
2. Click "Mark Read & Next"
3. Go back to book detail

**Actual:** Chunk 6 still shows as unread (gray). `currentChunkIndex` stays at 0.

**Root cause:** The API at `route.ts:49` only advances `currentChunkIndex` when `chunk.index === book.currentChunkIndex`:
```tsx
if (chunk.index === book.currentChunkIndex) {
```

A `reading_log` entry IS created, but book detail derives read status solely from `currentChunkIndex` comparison (`book/[bookId]/page.tsx:62,270`):
```tsx
const readCount = chapter.chunkIndices.filter(idx => idx < book.currentChunkIndex).length;
// ...
const isRead = idx < book.currentChunkIndex;
```

So `reading_log` entries for skipped-ahead chunks are invisible to the UI.

---

## Bug 4: Last chunk completion is inconsistent with skip-ahead

**Severity:** High
**File:** `src/app/api/chunks/[id]/read/route.ts:49-62`

If a user reads the last chunk by skipping ahead (not sequentially), the book is NOT marked as "completed" because `chunk.index !== book.currentChunkIndex`. The `bookCompleted` flag stays false. This compounds Bug 3.

---

## Bug 5: E2E test passes vacuously (false positive)

**Severity:** Low
**File:** `e2e/reading/read.spec.ts:39-42`

The test `"should not show Previous nav link on first chunk"` passes because it looks for `page.locator("nav").getByRole("link", { name: "Previous" })` — but the `<nav>` element no longer exists at all. The test is a false positive; it doesn't validate the current UI.

---

## Bug 6: Four E2E tests broken by navigation overhaul

**Severity:** Medium
**File:** `e2e/reading/read.spec.ts:44,49,59,68`

These tests reference the removed `<nav>` element, "Previous"/"Next" links, and "End of book" text. They need to be rewritten to test:
- "Back to Book" button navigation
- "Mark Read & Next" button flow (mark + navigate to next chunk)
- Last chunk behavior (mark + navigate to book detail)

---

## Summary by Priority

| # | Bug | Severity | Fix Location |
|---|-----|----------|-------------|
| 3 | Skip-ahead reads invisible | High | `route.ts:49` + `book/[bookId]/page.tsx:62,270` |
| 4 | Last chunk skip-ahead doesn't complete book | High | `route.ts:49-62` |
| 1 | Last chunk button label wrong | Medium | `reading-actions.tsx:68` |
| 2 | No error feedback on failure | Medium | `reading-actions.tsx:39-41` |
| 6 | 4 broken E2E tests | Medium | `read.spec.ts:44,49,59,68` |
| 5 | False positive E2E test | Low | `read.spec.ts:39-42` |

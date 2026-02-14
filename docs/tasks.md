# Micro Reads — Implementation Tasks

> Small, testable tasks ordered so each builds on what came before.

---

## Phase 1: Foundation

### 1.1 Project Scaffolding
- [x] Initialize Next.js 14+ project with App Router and TypeScript
- [x] Install and configure Tailwind CSS + shadcn/ui
- [x] Install Drizzle ORM + better-sqlite3 driver
- [x] Create `drizzle.config.ts` pointing to `./data/microread.db`
- [x] Add `.env.local` template with all env vars from spec (AUTH_SECRET, SMTP_*, etc.)
- [x] Add `data/` and `covers/` to `.gitignore`

**Test:** `npm run dev` starts without errors; Tailwind classes render.

### 1.2 Database Schema & Migrations
- [x] Define `books` table schema in Drizzle (all columns from spec)
- [x] Define `chunks` table schema with FK to books
- [x] Define `reading_log` table schema with FKs to chunks and books
- [x] Define `settings` table schema (key/value)
- [x] Generate and run initial migration
- [x] Create a `db.ts` module exporting the Drizzle client instance

**Test:** Migration runs cleanly; can insert and query a row in each table via a throwaway script.

### 1.3 EPUB Parsing Service
- [x] Install epub parsing library (`epub2` or `@nicolo-ribaudo/epub`)
- [x] Create `lib/epub.ts` with a `parseEpub(filePath)` function
- [x] Extract metadata: title, author, cover image
- [x] Extract ordered chapter list from the spine
- [x] Extract HTML content for each chapter
- [x] Save cover image to `covers/[bookId].jpg`

**Test:** Pass a sample `.epub` file; verify extracted title, author, chapter count, and cover file on disk.

### 1.4 Chunking Algorithm
- [x] Create `lib/chunker.ts` with `chunkBook(chapters, targetWords)` function
- [x] Implement paragraph extraction from chapter HTML
- [x] Implement word counting utility
- [x] Respect paragraph boundaries (never split mid-paragraph)
- [x] Prefer chapter boundaries when buffer >= 60% of target
- [x] Split long chapters at ~120% of target word count
- [x] Preserve inline HTML formatting (em, strong, blockquote) within chunks
- [x] Return array of `{ chapterTitle, contentHtml, contentText, wordCount }`

**Test:** Feed chapters of known word counts; verify chunk count, no mid-paragraph splits, word counts within expected range.

### 1.5 Book Upload Pipeline (Backend)
- [x] Create `POST /api/books` route accepting multipart epub upload
- [x] Save uploaded epub to `data/epubs/[bookId].epub`
- [x] Call `parseEpub` to extract metadata and cover
- [x] Call `chunkBook` to generate chunks
- [x] Insert `books` row with metadata and computed `total_chunks`
- [x] Batch-insert all `chunks` rows with sequential indices
- [x] Return created book object with id, title, author, total_chunks

**Test:** POST an epub file; verify book row exists in DB, chunks are sequential, cover file saved.

---

## Phase 2: Core Reading Experience

### 2.1 Library Page — API
- [x] Create `GET /api/books` returning all books with progress info
- [x] Include computed fields: progress percentage, chunks read count
- [x] Sort: active first, then queued, then completed

**Test:** Seed DB with books in various statuses; verify response shape and sort order.

### 2.2 Library Page — UI
- [x] Create `/` page with book cards (cover, title, author, progress bar, status badge)
- [x] Group into Active, Queued, Completed sections
- [x] "Upload Book" button linking to `/upload`
- [x] Completed section collapsed by default

**Test:** Renders seeded books in correct sections; progress bars reflect DB state.

### 2.3 Upload Flow — UI
- [x] Create `/upload` page with drag-and-drop + file picker for `.epub`
- [x] On file select, POST to `/api/books`
- [x] Display extracted metadata (cover, title, author) for confirmation
- [x] Chunk size slider (300–3000 words) with default 1000
- [x] Show estimated chunk count and completion time preview
- [x] "Add to Active" / "Add to Queue" buttons that PATCH book status
- [x] Redirect to library on success

**Test:** Upload an epub; see metadata preview; adjust slider; confirm and verify book appears in library.

### 2.4 Reading View — API
- [x] Create `GET /api/chunks/[id]` returning chunk with book context
- [x] Include: content_html, chapter_title, index, total_chunks, book title, ai_recap
- [x] Include prev/next chunk IDs for navigation

**Test:** Request a mid-book chunk; verify prev/next IDs, correct content, book metadata present.

### 2.5 Reading View — UI
- [x] Create `/read/[chunkId]` page
- [x] Top bar: book title, chapter title, "Chunk X of Y"
- [x] Content area with serif font (Literata/Source Serif Pro), ~60ch width, 1.7–1.8 line-height
- [x] Light mode: off-white (#FAFAF7) background, dark charcoal text
- [x] Dark mode: warm dark (#1A1A1A) background, soft cream (#E8E4DC) text
- [x] Previous / Next navigation buttons
- [x] Thin progress bar at page bottom showing position in book

**Test:** Navigate to a chunk; verify typography, dark/light toggle, prev/next navigation works.

### 2.6 Mark as Read
- [x] Create `POST /api/chunks/[id]/read` route
- [x] Insert `reading_log` entry with `read_at = now`, `read_via` param
- [x] Advance `books.current_chunk_index` if this chunk is the current one
- [x] If final chunk, set book status to `completed` and `completed_at`
- [x] Add "Mark as Read" button to reading view UI
- [x] After marking, auto-navigate to next chunk (or show completion message)

**Test:** Mark a chunk read; verify reading_log row, book index advanced. Mark final chunk; verify book completed.

---

## Phase 3: Email Digest

### 3.1 Email Template
- [x] Install React Email + Nodemailer
- [x] Create digest email component matching spec layout
- [x] Per-book section: cover, title, author, progress, teaser (~100 words plain text)
- [x] "Continue Reading" link pointing to `/read/[chunkId]`
- [x] Footer with streak count and quick action links
- [ ] Test rendering with `react-email preview`

**Test:** Render email with mock data; verify HTML output is valid and links are correct.

### 3.2 Digest Send Logic
- [x] Create `lib/digest.ts` with `sendDailyDigest()` function
- [x] Query active books, get next unread chunk for each
- [x] Generate teaser text (first ~100 words of plain text content)
- [x] Compose email with all book sections
- [x] Create `reading_log` entries with `sent_at` for each chunk
- [x] Send via Nodemailer SMTP using env config
- [x] Handle edge case: book completed mid-rotation (include celebration, activate next queued book)
- [x] Handle edge case: no active books (skip or send empty-list email)

**Test:** Seed two active books; call `sendDailyDigest()`; verify reading_log entries created, email sent (use test SMTP).

### 3.3 Digest API & Preview
- [x] Create `POST /api/digest/send` route (manual trigger)
- [x] Make idempotent: if already sent today, re-send same chunks without advancing
- [x] Create `GET /api/digest/preview` returning the email HTML without sending

**Test:** Trigger send; trigger again same day; verify no double-advance. Preview returns valid HTML.

### 3.4 Cron Scheduling
- [x] Install `node-cron`
- [x] On app startup, read `send_time` from settings and schedule `sendDailyDigest()`
- [x] Reschedule if setting is updated
- [x] Log send attempts and results

**Test:** Set cron to 1 minute from now; verify digest fires and log entry created.

---

## Phase 4: Auth

### 4.1 Password Login
- [x] Create login page at `/login`
- [x] Validate password against hashed `AUTH_SECRET` env var
- [x] Set HTTP-only session cookie on success
- [x] Create auth middleware protecting all routes except `/login` and `/read/[chunkId]` (token auth)
- [x] Redirect unauthenticated requests to `/login`

**Test:** Access library without cookie — redirected. Login with correct password — cookie set, access granted.

### 4.2 Email Link Tokens
- [x] Generate short-lived signed tokens (HMAC or JWT) for each chunk link in emails
- [x] Accept token as query param on `/read/[chunkId]?token=...`
- [x] Validate token without requiring session cookie
- [x] Token expires after 7 days

**Test:** Generate token for chunk; access with valid token — renders. Expired/tampered token — rejected.

### 4.3 API Trigger Auth
- [x] Read bearer token from settings
- [x] Create `POST /api/trigger` route protected by bearer token
- [x] Calls `sendDailyDigest()` on valid auth

**Test:** Call with valid bearer — digest sent. Call with wrong token — 401.

---

## Phase 5: Book Management

### 5.1 Book Detail Page
- [x] Create `GET /api/books/[id]` returning full book detail with chapter list
- [x] Include per-chapter read/unread status, reading stats (chunks read, words read, days active)
- [x] Compute estimated completion date based on current daily cadence
- [x] Create `/book/[bookId]` page with cover, metadata, chapter list, stats, completion estimate

**Test:** View a partially-read book; verify chapter read indicators match reading_log data.

### 5.2 Book Controls
- [x] PATCH `/api/books/[id]` supporting status changes (pause, resume, mark complete)
- [x] Add Pause / Resume / Mark Complete buttons to book detail page
- [x] Paused books excluded from daily digest
- [x] Implement "Restart" action: reset `current_chunk_index` to 0, set status active (preserve reading_log)

**Test:** Pause a book; trigger digest; verify it's skipped. Resume; verify it's included again.

### 5.3 Chunk Size Adjustment
- [x] Add chunk size control to book detail page
- [x] On change: delete chunks with `index > current_chunk_index`
- [x] Re-chunk remaining epub content with new size
- [x] Insert new chunks and update `total_chunks`
- [x] Preserve existing reading_log entries

**Test:** Change chunk size mid-book; verify old chunks preserved, new chunks regenerated, total updated.

### 5.4 Book Deletion
- [x] `DELETE /api/books/[id]` removes book, all chunks, all reading_log entries
- [x] Delete epub file and cover image from disk
- [x] Add delete button with confirmation dialog to book detail page

**Test:** Delete a book; verify all related DB rows and files removed.

---

## Phase 6: Stats & Settings

### 6.1 Stats API
- [x] `GET /api/stats` — total books completed, total words read, current streak, longest streak
- [x] `GET /api/stats/calendar` — reading days as `{ date: string, count: number }[]` for heatmap
- [x] Streak calculation: consecutive days with at least one `read_at` in reading_log

**Test:** Seed reading_log with known dates; verify streak counts and calendar data.

### 6.2 Stats Page
- [x] Create `/stats` page
- [x] Total stats cards (books completed, words read, streaks)
- [x] Reading calendar heatmap (GitHub-style)
- [x] Words-per-day pace chart (bar chart)
- [ ] Books timeline (horizontal bars showing start/finish dates)

**Test:** Page renders with seeded data; charts display correct values.

### 6.3 Settings Page
- [x] `GET /api/settings` and `PUT /api/settings` routes
- [x] Create `/settings` page with form fields for: email address, send time, Ollama endpoint/model
- [x] "Send Today's Digest Now" button (calls `/api/digest/send`)
- [x] "Send Test Email" button
- [x] Seed default settings on first run

**Test:** Update send time; verify setting persisted. Hit manual trigger; verify email sent.

---

## Phase 7: AI Recaps

### 7.1 Ollama Integration
- [ ] Create `lib/ollama.ts` with `generateRecap(params)` function
- [ ] Implement prompt template from spec
- [ ] Call Ollama API at configured endpoint
- [ ] Return recap text or fallback string if Ollama unavailable

**Test:** With Ollama running, generate recap for sample text; verify output is <75 words. With Ollama down, verify graceful fallback.

### 7.2 Recap Generation Pipeline
- [ ] After epub processing, queue background recap generation for all chunks (skip first)
- [ ] Use rolling summary approach: each recap builds on previous recap + chunk content
- [ ] Store recaps in `chunks.ai_recap` column
- [ ] Add progress indicator for recap generation on book detail page

**Test:** Process a book; verify recaps generated for chunks 2+; first chunk has null recap.

### 7.3 Recap Display
- [ ] Show collapsible "Previously..." block in reading view
- [ ] Warm gray background, italic text
- [ ] Hidden if `ai_recap` is null (first chunk or Ollama was down)

**Test:** View chunk with recap — block visible. View first chunk — block hidden.

---

## Phase 8: Queue Management & Polish

### 8.1 Queue Ordering
- [ ] Add `queue_position` column to books table
- [ ] Drag-to-reorder queued books on library page
- [ ] `PATCH /api/books/reorder` accepting ordered list of book IDs
- [ ] When active book completes, auto-activate lowest-position queued book

**Test:** Reorder queue; verify positions saved. Complete active book; verify next queued book activates.

### 8.2 "Send Me More" Button
- [ ] Add button to reading view bottom controls
- [ ] Calls endpoint that immediately sends next chunk via email
- [ ] Does not affect daily digest schedule

**Test:** Click "Send Me More"; verify email sent with next chunk; next daily digest still sends normally.

### 8.3 Docker Setup
- [ ] Create `Dockerfile` (multi-stage build for Next.js)
- [ ] Create `docker-compose.yml` with volume mounts for data/ and covers/
- [ ] Environment variables for all config
- [ ] Health check endpoint

**Test:** `docker compose up` starts app; upload a book and trigger digest from within container.

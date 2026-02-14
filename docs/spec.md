# Micro Reads — Product Spec & Architecture

> A personal daily reading app that delivers bite-sized chunks from your epub library to your inbox each morning, backed by a polished web app for reading, tracking, and stats.

---

## Core Concept

Every morning, you receive a single email digest containing a short reading chunk from each of your active books (2–3 in rotation). The email includes a teaser paragraph and a link to the full chunk in a web app. The web app is the primary reading experience — beautifully typeset, dark mode, with a library view, reading stats, and progress tracking.

**Design Philosophy:** This is a morning coffee ritual, not another infinite scroll. The constraint of one chunk per book per day is the feature. The daily email is a newspaper, not a notification.

---

## User Stories

1. **Upload & Configure** — I upload an epub via the web UI, set the chunk size (e.g., 500 words for philosophy, 2000 for fiction), and add it to my active rotation.
2. **Morning Digest** — At 6:30 AM, I receive an email with today's readings. Each book section shows the cover, title, progress, a teaser paragraph, and a "Continue Reading →" link.
3. **Read in Web App** — I tap the link, land on the full chunk with beautiful typography, and read with my coffee. At the bottom: "Mark as Read" and "Send More" buttons.
4. **Track Progress** — On the library page, I see all my books with progress bars, estimated completion dates, and a reading activity calendar.
5. **AI Recap** — Each chunk starts with a brief AI-generated "Previously..." summary so I can context-switch between books without losing the thread.
6. **Manual Trigger** — If I want today's email early or want to re-send it, I hit a button in the web app (or an API endpoint from an iOS Shortcut).

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | Full-stack, API routes + React UI in one project |
| Database | **SQLite** via **Drizzle ORM** | Zero infra, easy backups, more than enough for personal use |
| EPUB Parsing | **epub2** or **@nicolo-ribaudo/epub** | Extract chapters, metadata, cover images |
| Email | **React Email** + **Nodemailer** (SMTP) | Beautiful templated emails, self-hosted friendly |
| AI Recaps | **Ollama API** (local) | Free, private, leverages existing local infra |
| Scheduling | **node-cron** (in-process) or system cron | Triggers daily digest send |
| Styling | **Tailwind CSS** + **shadcn/ui** | Polished UI with dark mode out of the box |
| Deployment | **Self-hosted** (Docker on VPS/home server) | Full control, no recurring SaaS costs |

---

## Data Model

### `books`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `title` | TEXT | Book title (from epub metadata) |
| `author` | TEXT | Author name(s) |
| `cover_image` | BLOB / TEXT (path) | Cover image extracted from epub |
| `epub_path` | TEXT | Path to stored epub file on disk |
| `chunk_size_words` | INTEGER | Target words per chunk (default: 1000) |
| `status` | TEXT | `active` · `paused` · `completed` · `queued` |
| `total_chunks` | INTEGER | Computed after epub processing |
| `current_chunk_index` | INTEGER | Current position (0-based) |
| `added_at` | DATETIME | When the book was uploaded |
| `completed_at` | DATETIME | Nullable, set when finished |

### `chunks`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `book_id` | TEXT (FK) | References `books.id` |
| `index` | INTEGER | Sequential order within the book |
| `chapter_title` | TEXT | Source chapter title |
| `content_html` | TEXT | The formatted chunk content |
| `content_text` | TEXT | Plain text version (for email teasers + word count) |
| `word_count` | INTEGER | Actual word count of this chunk |
| `ai_recap` | TEXT | Nullable, AI-generated "story so far" summary |

### `reading_log`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `chunk_id` | TEXT (FK) | References `chunks.id` |
| `book_id` | TEXT (FK) | References `books.id` |
| `sent_at` | DATETIME | When the chunk was emailed |
| `read_at` | DATETIME | Nullable, when user marked as read |
| `read_via` | TEXT | `email_link` · `web_app` · `manual_trigger` |

### `settings`
| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT | Setting name |
| `value` | TEXT | JSON-encoded value |

Settings include: `send_time` (cron expression), `email_address`, `max_active_books`, `ollama_model`, `ollama_endpoint`.

---

## EPUB Processing Pipeline

When a book is uploaded:

1. **Parse EPUB** — Extract metadata (title, author, cover image, chapter structure)
2. **Extract Content** — Pull chapter HTML/text from the epub spine
3. **Chunk** — Split content into chunks of approximately `chunk_size_words`:
   - Respect paragraph boundaries (never split mid-paragraph)
   - Prefer splitting at scene breaks (`<hr>`, `* * *`, extra whitespace)
   - If a chapter is shorter than `chunk_size_words`, keep it as one chunk
   - If a chapter is much longer, split into multiple chunks, preferring natural breaks
   - Preserve HTML formatting (italics, bold, block quotes) within chunks
4. **Store** — Save chunks to database with sequential indices
5. **Generate AI Recaps** (async, background job) — For each chunk after the first, call Ollama to generate a 2–3 sentence "Previously..." recap based on all prior chunks' plain text

### Chunking Algorithm (Pseudocode)

```
function chunkBook(chapters, targetWords):
  chunks = []
  buffer = []
  bufferWordCount = 0

  for chapter in chapters:
    paragraphs = extractParagraphs(chapter)
    for paragraph in paragraphs:
      words = countWords(paragraph)
      if bufferWordCount + words > targetWords * 1.2 AND bufferWordCount > 0:
        chunks.push(joinParagraphs(buffer))
        buffer = [paragraph]
        bufferWordCount = words
      else:
        buffer.push(paragraph)
        bufferWordCount += words

    // Prefer chapter boundaries as chunk boundaries
    if bufferWordCount >= targetWords * 0.6:
      chunks.push(joinParagraphs(buffer))
      buffer = []
      bufferWordCount = 0

  if buffer.length > 0:
    chunks.push(joinParagraphs(buffer))

  return chunks
```

---

## Pages & UI

### 1. Library (`/`)
The home page. A bookshelf view showing all books.

- **Active books** at the top — card per book showing: cover image, title, author, progress bar with percentage, estimated completion date (based on current cadence), status badge
- **Queued books** below — ordered queue, drag to reorder
- **Completed books** — collapsed section with finished books and total reading time
- **"Upload Book" button** — opens upload flow
- **Reading activity calendar** — GitHub-style heatmap showing reading days (v2 feature, but leave space for it)

### 2. Upload Flow (`/upload`)
- Drag-and-drop or file picker for `.epub` files
- After upload, show extracted metadata (cover, title, author) for confirmation
- Chunk size slider (300–3000 words) with estimated chunks count and completion time preview
- "Add to Active" or "Add to Queue" buttons

### 3. Reading View (`/read/[chunkId]`)
This is the core reading experience. It should feel like a premium e-reader.

- **Top bar:** Book title · Chapter title · "Chunk 12 of 47"
- **AI Recap block** (collapsible): Warm gray background, italic, "Previously..." summary
- **Content area:** Generous margins, serif font (Literata or Source Serif Pro), ~60ch line width, comfortable line-height (1.7–1.8)
- **Bottom controls:**
  - "← Previous" / "Next →" navigation
  - "✓ Mark as Read" button (advances `current_chunk_index`)
  - "📖 Send Me More" button (queues immediate delivery of next chunk via email)
- **Progress bar** at the very bottom of the page — thin, showing position in entire book

**Typography & Design:**
- Light mode: warm off-white (#FAFAF7) background, dark charcoal text
- Dark mode: warm dark (#1A1A1A) background, soft cream text (#E8E4DC)
- Serif reading font at ~18–20px
- Smooth transition between modes
- No visual clutter — the content is the hero

### 4. Book Detail (`/book/[bookId]`)
- Cover image, full metadata
- Chapter list with read/unread indicators
- Reading stats for this book: chunks read, words read, days active, average pace
- Estimated completion date
- Chunk size adjustment (reprocesses remaining chunks)
- Pause / Resume / Mark Complete controls

### 5. Stats (`/stats`)
- **Total stats:** Books completed, total words read, current streak, longest streak
- **Reading calendar:** GitHub-style heatmap (days you read)
- **Pace chart:** Words read per day over time (line chart)
- **Books timeline:** Horizontal bar chart showing when you started/finished each book

### 6. Settings (`/settings`)
- Email address for digest delivery
- Send time (hour picker, timezone display)
- Ollama configuration (endpoint URL, model name)
- Manual trigger button: "Send Today's Digest Now"
- Test email button

---

## API Routes

### Books
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/books` | List all books with progress |
| `POST` | `/api/books` | Upload new epub (multipart form) |
| `GET` | `/api/books/[id]` | Get book detail |
| `PATCH` | `/api/books/[id]` | Update settings (chunk size, status) |
| `DELETE` | `/api/books/[id]` | Remove book and all data |

### Chunks
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/books/[id]/chunks` | List chunks for a book |
| `GET` | `/api/chunks/[id]` | Get single chunk content |
| `POST` | `/api/chunks/[id]/read` | Mark chunk as read |

### Digest
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/digest/send` | Manually trigger today's digest |
| `GET` | `/api/digest/preview` | Preview next digest (for testing) |

### Stats
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/stats` | Aggregate reading stats |
| `GET` | `/api/stats/calendar` | Reading calendar data |

### Settings
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings |

### External / Shortcuts
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/trigger` | Simple trigger endpoint (for iOS Shortcuts). Auth via bearer token in settings. |

---

## Email Design

The daily digest email should be clean, well-typeset, and work across clients.

### Structure

```
┌──────────────────────────────────────┐
│  📖  MICRO READS · Feb 14, 2026     │
│  Your morning reading                │
├──────────────────────────────────────┤
│                                      │
│  [Cover]  Meditations               │
│           Marcus Aurelius            │
│           Book IV · 63% complete     │
│                                      │
│  "Begin each day by telling          │
│   yourself: today I shall meet       │
│   with interference, ingratitude..." │
│                                      │
│         [ Continue Reading → ]       │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  [Cover]  Project Hail Mary         │
│           Andy Weir                  │
│           Chapter 12 · 34% complete  │
│                                      │
│  "The lab results came back and      │
│   everything changed. Rocky's        │
│   metabolism was..."                 │
│                                      │
│         [ Continue Reading → ]       │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Today: 2 books · ~7 min reading    │
│  Streak: 12 days 🔥                 │
│                                      │
│  [ Open Library ]  [ Send More ]    │
│                                      │
└──────────────────────────────────────┘
```

### Implementation
- Built with **React Email** for component-based templates
- Sent via **Nodemailer** with SMTP (any provider — Gmail, Fastmail, self-hosted)
- Teaser is first ~100 words of the chunk (plain text, no complex HTML)
- "Continue Reading" link points to `/read/[chunkId]` with a token for stateless auth
- Footer includes streak count and quick action links

---

## AI Recap Generation

### Prompt Template (for Ollama)

```
You are helping a reader remember where they left off in a book.

Book: {title} by {author}
Current position: Chunk {n} of {total}

Here is what the reader has read so far (summary of previous chunks):
{accumulated_summary}

Here is the content they are about to read:
{current_chunk_first_sentence}

Write a 2-3 sentence "Previously..." recap that helps the reader
pick up where they left off. Be specific about characters, events,
and key ideas. Write in present tense. Keep it under 75 words.
```

### Strategy
- **Pre-generate** recaps during epub processing (background job)
- Use a rolling summary approach: each chunk's recap builds on the previous recap + the chunk content, rather than re-reading all prior chunks
- Cache recaps in the `chunks.ai_recap` column
- Model: Use a fast local model (Qwen 2.5 7B or similar) since recaps are short tasks
- Fallback: If Ollama is unavailable, show "Chapter X, continued" instead of failing

---

## Scheduling & Delivery Logic

### Daily Digest Flow

```
[Cron triggers at configured time]
       │
       ▼
[Get active books where status = 'active']
       │
       ▼
[For each active book:]
  ├─ Get next unread chunk (current_chunk_index + 1)
  ├─ Generate email section (cover, title, progress, teaser)
  └─ Create reading_log entry (sent_at = now)
       │
       ▼
[Compose digest email with all sections]
       │
       ▼
[Send via SMTP]
       │
       ▼
[Log delivery status]
```

### Edge Cases
- **Book completed mid-rotation:** Auto-advance to next queued book, include a "🎉 You finished {title}!" section in the email
- **No active books:** Send a gentle "Your reading list is empty — upload something new?" email (or skip)
- **Ollama down:** Skip AI recap gracefully, deliver content anyway
- **Manual trigger:** Same flow as above, but idempotent — if already sent today, re-sends the same chunks (doesn't advance)

---

## Auth Model

Since this is personal use, keep it simple:

- **Web app:** Single-user auth. An environment variable `AUTH_SECRET` used to generate a session cookie. Simple password login page.
- **Email links:** Each "Continue Reading" link includes a short-lived token (e.g., JWT or HMAC-signed chunk ID) so clicking from email doesn't require login.
- **API trigger:** Bearer token auth for the `/api/trigger` endpoint (used by iOS Shortcuts).

No user registration, no multi-tenant anything.

---

## Build Phases

### Phase 1 — Core Reading Loop (MVP)
- [ ] Project scaffolding (Next.js, Drizzle, SQLite)
- [ ] EPUB upload and parsing
- [ ] Chunking algorithm
- [ ] Basic reading view with typography
- [ ] Library page with progress bars
- [ ] Daily email digest with cron
- [ ] Mark as read / next chunk navigation
- [ ] Simple auth (password login + email tokens)

**Goal:** You can upload a book and start getting daily emails that link to a readable web view.

### Phase 2 — Polish & Stats
- [ ] Dark mode with warm color palette
- [ ] Book detail page with chapter list
- [ ] Stats page (calendar, streaks, pace)
- [ ] Estimated completion dates
- [ ] Upload flow with metadata preview and chunk size picker
- [ ] "Send More" functionality
- [ ] Settings page with email/schedule configuration

**Goal:** The app feels polished and you have visibility into your reading habits.

### Phase 3 — AI & Automation
- [ ] Ollama integration for recap generation
- [ ] "Previously..." block in reading view
- [ ] Background job for pre-generating recaps
- [ ] API trigger endpoint for iOS Shortcuts
- [ ] Queue management (auto-advance on completion)
- [ ] Book completion celebrations in email

**Goal:** The experience is smart and automated — it just works every morning.

### Phase 4 — Nice-to-Haves (Future)
- [ ] Reading activity calendar (GitHub heatmap)
- [ ] Highlights / annotations on chunks
- [ ] Export reading log (JSON/CSV)
- [ ] Multiple reading schedules (weekday vs weekend cadence)
- [ ] Adjustable chunk size per-read (speed up on weekends)
- [ ] Book recommendations based on reading history
- [ ] iOS Shortcut for "what am I reading?" summary
- [ ] PWA with service worker for offline reading of delivered chunks

---

## Docker Setup (Outline)

```yaml
# docker-compose.yml
services:
  micro-reads:
    build: .
    ports:
      - "3333:3000"
    volumes:
      - ./data:/app/data        # SQLite DB + epub storage
      - ./covers:/app/covers    # Extracted cover images
    environment:
      - AUTH_SECRET=your-secret-here
      - SMTP_HOST=smtp.fastmail.com
      - SMTP_PORT=587
      - SMTP_USER=you@example.com
      - SMTP_PASS=app-password
      - EMAIL_TO=you@example.com
      - SEND_TIME=0 6 30 * * *
      - OLLAMA_ENDPOINT=http://host.docker.internal:11434
      - OLLAMA_MODEL=qwen2.5:7b
```

---

## Design Decisions (Resolved)

1. **Chunk size recalculation** — Reprocess from current position forward only. Prior chunks and reading log entries are preserved as-is. When triggered, delete all chunks with `index > current_chunk_index`, re-chunk remaining content with the new size, and update `total_chunks`.
2. **Multiple reads of the same book** — Supported via a "Restart" action on the book detail page. Requires confirmation dialog ("This will reset your progress but your reading history is preserved. Continue?"). Resets `current_chunk_index` to 0 and `status` to `active`. Historical `reading_log` entries are never deleted.
3. **Book format support** — EPUB only for v1. No conversion pipeline needed.
4. **Offline reading** — PWA with service worker for offline chunk reading. Slated for Phase 4.

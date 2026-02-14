# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Micro Reads is a personal daily reading app that splits epub books into bite-sized chunks and delivers them via a morning email digest. A web app provides the primary reading experience with library management, progress tracking, and stats.

Single-user, self-hosted. No multi-tenant complexity.

## Tech Stack

- **Framework:** Next.js 14+ with App Router (full-stack: API routes + React UI)
- **Database:** SQLite via Drizzle ORM (DB at `./data/microread.db`)
- **Styling:** Tailwind CSS + shadcn/ui (dark mode support)
- **Email:** React Email + Nodemailer (SMTP)
- **AI Recaps:** Ollama API (local, optional — app must work without it)
- **Scheduling:** node-cron (in-process)

## Build & Dev Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations
```

## Architecture

### Data Flow

Epub upload → parse metadata/chapters → chunk by word count → store in SQLite → daily cron sends email digest with teasers → user reads full chunks in web app → mark as read advances progress.

### Key Modules (under `src/lib/`)

- **`db/schema.ts`** — Drizzle table definitions
- **`db/index.ts`** — Drizzle client instance
- **`epub.ts`** — Epub parsing: metadata extraction, chapter content, cover images
- **`chunker.ts`** — Splits chapter HTML into word-count-targeted chunks respecting paragraph/chapter boundaries
- **`digest.ts`** — Composes and sends the daily email digest
- **`ollama.ts`** — AI recap generation via local Ollama (graceful fallback when unavailable)

### Database Tables

Four tables: `books`, `chunks`, `reading_log`, `settings`. See `docs/spec.md` for full schema. Key relationships:
- `chunks.book_id` → `books.id`
- `reading_log.chunk_id` → `chunks.id`, `reading_log.book_id` → `books.id`
- `settings` is a simple key/value store

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Library — bookshelf with active/queued/completed sections |
| `/upload` | Epub upload with metadata preview and chunk size config |
| `/read/[chunkId]` | Core reading view — premium typography, navigation, mark-as-read |
| `/book/[bookId]` | Book detail — chapters, stats, controls |
| `/stats` | Reading stats, calendar heatmap, pace charts |
| `/settings` | Email, schedule, Ollama config |
| `/login` | Single-user password auth |

### Auth Model

- **Web app:** Password login via `AUTH_SECRET` env var → session cookie
- **Email links:** HMAC-signed tokens in URLs (7-day expiry, no login required)
- **API trigger:** Bearer token for `/api/trigger` (iOS Shortcuts)

### File Storage

- Epubs: `data/epubs/[bookId].epub`
- Covers: `covers/[bookId].jpg`
- Database: `data/microread.db`
- All three directories are gitignored and volume-mounted in Docker

## Design Constraints

- **Reading view typography:** Serif font (Literata/Source Serif Pro), ~60ch line width, 1.7–1.8 line-height, generous margins. Light mode: #FAFAF7 bg. Dark mode: #1A1A1A bg, #E8E4DC text.
- **Chunking:** Never split mid-paragraph. Prefer chapter boundaries when buffer ≥ 60% of target. Split at ~120% of target. Preserve inline HTML formatting.
- **Digest idempotency:** Manual re-trigger on same day re-sends same chunks without advancing position.
- **Ollama is optional:** Every feature must work without it. Show "Chapter X, continued" as fallback recap.

## Reference

- Full product spec: `docs/spec.md`
- Implementation task list: `docs/tasks.md`

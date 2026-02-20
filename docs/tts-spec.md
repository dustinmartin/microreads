# Text-to-Speech with ElevenLabs

## Context

Add on-demand text-to-speech audio playback for reading chunks using the ElevenLabs streaming API. A "Listen" button appears on the chunk reading page (and in the email digest) when an ElevenLabs API key is configured in settings. Audio is generated on first listen, streamed for immediate playback, cached to disk for re-listening, and cleaned up when a book is completed or deleted.

---

## 1. Database: Add `audio_cache` table

**File:** `src/lib/db/schema.ts`

Add a new `audioCache` table:
- `id` (text PK) - UUID
- `chunkId` (text, unique, FK → chunks.id, cascade delete)
- `bookId` (text, FK → books.id, cascade delete)
- `filePath` (text) - relative path e.g. `data/audio/{chunkId}.mp3`
- `voiceId` (text) - ElevenLabs voice used
- `fileSizeBytes` (integer, nullable)
- `createdAt` (text) - ISO timestamp

The cascade FKs ensure DB rows auto-clean when chunks/books are deleted. Run `npx drizzle-kit generate` + `npx drizzle-kit migrate` after.

## 2. ElevenLabs client module

**New file:** `src/lib/elevenlabs.ts`

Two exported functions:

- `getElevenLabsConfig()` — reads `elevenlabs_api_key` and `elevenlabs_voice_id` from the settings table. Returns `null` if no API key (feature disabled). Default voice: `21m00Tcm4TlvDq8ikWAM` (Rachel).

- `generateSpeechStream(text, config)` — POSTs to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream` with the chunk's plain text. Returns a `ReadableStream<Uint8Array>` of MP3 data. Uses `eleven_multilingual_v2` model.

- `deleteBookAudioFiles(bookId)` — queries `audioCache` for the book, deletes each file from disk via `fs.unlinkSync`, then deletes the DB rows. Errors silently caught (matches existing epub/cover cleanup pattern).

## 3. Audio API route

**New file:** `src/app/api/chunks/[id]/audio/route.ts`

`GET /api/chunks/[id]/audio?token=xxx` — the core endpoint:

1. Validate auth: session cookie OR token (via `verifyChunkToken`)
2. Look up chunk (404 if missing)
3. Check ElevenLabs config (503 if not configured)
4. **Cache check:** Query `audioCache` for this chunkId. If found and file exists on disk, return the file directly with `Content-Type: audio/mpeg`
5. **Generate:** Call `generateSpeechStream()`, `tee()` the stream — one copy streams to the client response immediately, the other writes to `data/audio/{chunkId}.mp3` in the background. After the file is fully written, insert into `audioCache`.

Also add a `HEAD` handler for the client to check if audio is already cached (200 vs 404).

## 4. Middleware update

**File:** `src/middleware.ts`

Add the audio API path to `isPublicPath()`:
```
if (/^\/api\/chunks\/[^/]+\/audio$/.test(pathname)) return true;
```

This lets email-link users (who have a token but no session cookie) access the audio endpoint. The route itself validates the token.

## 5. Audio player component

**New file:** `src/app/read/[chunkId]/_components/audio-player.tsx`

Client component with props: `chunkId`, `autoplay`, `token?`

**States:** `idle` | `loading` | `playing` | `paused` | `error`

- **Idle:** Shows a "Listen" button (Headphones icon from lucide-react)
- **Loading:** Button shows spinner (`Loader2 animate-spin`), text "Generating audio..."
- **Playing/Paused:** Listen button is replaced by play/pause + rewind (15s) buttons that slide in via `transition-all duration-300` (translate-y + opacity)
- **Error:** Shows inline error message with retry on tap

Uses `new Audio(audioUrl)` (HTML5 audio element). Listens for `canplay` event to auto-play and transition to `playing` state. If `autoplay=true`, calls `startPlayback()` on mount via `useEffect` so the button starts in loading state immediately.

Audio URL: `/api/chunks/{chunkId}/audio` (with `?token=xxx` appended if token prop is present).

## 6. Reading page integration

**File:** `src/app/read/[chunkId]/page.tsx`

- Extend `searchParams` type to include `autoplay?: string`
- Query the settings table server-side for `elevenlabs_api_key` to determine if TTS is enabled
- Render `<AudioPlayer>` between the AI recap and the article content, only if TTS is enabled. Pass `autoplay={autoplay === "true"}` and `token={token}`.

## 7. Email digest changes

**File:** `src/lib/email/digest-template.tsx`
- Add optional `listenUrl?: string` to `BookSection` interface
- After the "Read on Web" button, render a "Listen" button linking to `listenUrl` (only when present). Use headphone emoji since email doesn't support SVG icons. Style as a complementary warm brown button.

**File:** `src/lib/digest.ts`
- Check once if `elevenlabs_api_key` is set in settings
- If configured, set `listenUrl: \`${baseUrl}/read/${chunk.id}?token=${token}&autoplay=true\`` on each book section (same readUrl with `&autoplay=true` appended)

## 8. Settings page

**File:** `src/app/settings/page.tsx`

Add a "Text-to-Speech" section (between AI Configuration and Save button) with:
- **ElevenLabs API key** — `type="password"` input, placeholder "sk_...", helper text linking to elevenlabs.io
- **Voice ID** — text input, placeholder/default `21m00Tcm4TlvDq8ikWAM` (Rachel), helper text about finding voice IDs in the ElevenLabs dashboard

Both values saved/loaded via the existing settings API (`elevenlabs_api_key`, `elevenlabs_voice_id` keys).

## 9. Audio file cleanup

Audio files must be deleted from disk in three places (DB rows auto-cascade):

**a. Book deletion** — `src/app/api/books/[id]/route.ts` DELETE handler
- Before deleting chunks (which would cascade-delete audio_cache rows), query audio_cache for the book and delete files from disk. Call `deleteBookAudioFiles(bookId)`.

**b. Book completion via mark-read** — `src/app/api/chunks/[id]/read/route.ts`
- After the `bookCompleted = true` block, call `deleteBookAudioFiles(chunk.bookId)` fire-and-forget with `.catch()`.

**c. Book completion via status PATCH** — `src/app/api/books/[id]/route.ts` PATCH handler
- When `status === "completed"`, call `deleteBookAudioFiles(id)` fire-and-forget.

## 10. File storage

Audio files stored at `data/audio/{chunkId}.mp3`. The `data/` directory is already gitignored and Docker volume-mounted. The audio directory is created at runtime with `fs.mkdirSync(AUDIO_DIR, { recursive: true })`.

---

## Files to modify
- `src/lib/db/schema.ts` — add `audioCache` table
- `src/middleware.ts` — add audio API to public paths
- `src/app/read/[chunkId]/page.tsx` — integrate audio player
- `src/lib/email/digest-template.tsx` — add Listen button
- `src/lib/digest.ts` — construct `listenUrl`
- `src/app/settings/page.tsx` — add TTS settings section
- `src/app/api/books/[id]/route.ts` — audio cleanup in DELETE + PATCH
- `src/app/api/chunks/[id]/read/route.ts` — audio cleanup on completion

## New files
- `src/lib/elevenlabs.ts` — ElevenLabs API client + cleanup helper
- `src/app/api/chunks/[id]/audio/route.ts` — audio generation/serving API
- `src/app/read/[chunkId]/_components/audio-player.tsx` — player UI component

## Verification
1. Configure an ElevenLabs API key in Settings, save, reload — verify it persists
2. Navigate to a chunk page — verify "Listen" button appears
3. Click "Listen" — verify spinner shows, then audio plays and controls slide in
4. Navigate away and back — verify cached audio plays immediately (no regeneration)
5. Send a test digest — verify "Listen" button appears in the email
6. Click the email "Listen" link — verify page opens with audio auto-loading
7. Delete a book that has cached audio — verify `data/audio/` files are removed
8. Mark a book as completed — verify audio files are cleaned up
9. With no API key configured — verify Listen button does not appear anywhere

# TTS Implementation Tasks

Tasks are ordered by dependency. Earlier tasks must complete before later ones that depend on them.

---

## Task 1: Database schema — add `audio_cache` table

**Depends on:** nothing

**Description:**
Add a new `audioCache` table to `src/lib/db/schema.ts` and generate + apply the migration.

**Changes:**
- `src/lib/db/schema.ts` — add `audioCache` table with columns:
  - `id` (text PK)
  - `chunkId` (text, unique, FK → chunks.id, `onDelete: "cascade"`)
  - `bookId` (text, FK → books.id, `onDelete: "cascade"`)
  - `filePath` (text, not null)
  - `voiceId` (text, not null)
  - `fileSizeBytes` (integer, nullable)
  - `createdAt` (text, not null)
- Export the new table from the schema file
- Run `npx drizzle-kit generate` to create the migration
- Run `npx drizzle-kit migrate` to apply it

**Acceptance criteria:**
- The `audio_cache` table exists in the database after migration
- Foreign keys cascade correctly (deleting a chunk or book removes related audio_cache rows)
- `npm run build` passes with no type errors

---

## Task 2: Settings page — add ElevenLabs configuration fields

**Depends on:** nothing

**Description:**
Add a "Text-to-Speech" settings section to the settings page for configuring the ElevenLabs API key and voice ID.

**Changes:**
- `src/app/settings/page.tsx`:
  - Add state variables: `elevenLabsApiKey` (default `""`), `elevenLabsVoiceId` (default `"21m00Tcm4TlvDq8ikWAM"`)
  - Load values from `/api/settings` on mount (keys: `elevenlabs_api_key`, `elevenlabs_voice_id`)
  - Include both keys in the `handleSave` PUT body
  - Add a "Text-to-Speech" section between the AI Configuration section and the Save button with:
    - API key field: `type="password"`, placeholder `"sk_..."`, helper text linking to elevenlabs.io, note that leaving it blank disables audio
    - Voice ID field: `type="text"`, placeholder `"21m00Tcm4TlvDq8ikWAM"`, helper text about finding voice IDs in the ElevenLabs dashboard
  - Match the existing card/section styling (rounded-xl border, heading + subtitle pattern)

**Acceptance criteria:**
- The "Text-to-Speech" section renders on the settings page between AI Configuration and Save
- API key is masked (password field)
- Saving persists both values — reload the page and they're still there
- The voice ID field shows the default Rachel voice ID as placeholder
- `npm run build` passes

---

## Task 3: ElevenLabs client module

**Depends on:** Task 1 (needs `audioCache` table import)

**Description:**
Create the `src/lib/elevenlabs.ts` module that handles ElevenLabs API configuration, speech generation, and audio file cleanup.

**Changes:**
- New file `src/lib/elevenlabs.ts` with three exported functions:

  **`getElevenLabsConfig(): Promise<{ apiKey: string; voiceId: string } | null>`**
  - Read `elevenlabs_api_key` and `elevenlabs_voice_id` from the settings table
  - Return `null` if API key is empty/missing (feature disabled)
  - Default voice ID: `"21m00Tcm4TlvDq8ikWAM"` if not set

  **`generateSpeechStream(text: string, config): Promise<ReadableStream<Uint8Array>>`**
  - POST to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream`
  - Headers: `xi-api-key`, `Content-Type: application/json`
  - Body: `{ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.5 } }`
  - Return the response body stream
  - Throw on non-OK response (include status + error text)

  **`deleteBookAudioFiles(bookId: string): Promise<void>`**
  - Query `audioCache` where `bookId` matches
  - Delete each file from disk with `fs.unlinkSync` (silently catch errors)
  - Delete the `audioCache` DB rows for the book

**Acceptance criteria:**
- `getElevenLabsConfig()` returns `null` when no API key is configured
- `getElevenLabsConfig()` returns the correct config when keys are set
- `generateSpeechStream()` makes the correct HTTP request (verify request structure)
- `deleteBookAudioFiles()` removes files from disk and DB rows
- `npm run build` passes

---

## Task 4: Audio API route

**Depends on:** Task 1, Task 3

**Description:**
Create the `GET /api/chunks/[id]/audio` endpoint that generates or serves cached TTS audio.

**Changes:**
- New file `src/app/api/chunks/[id]/audio/route.ts`

  **GET handler:**
  1. Accept optional `?token=` query param for email-link auth
  2. Validate auth: check session cookie validity OR verify chunk token. Return 401 if neither valid.
  3. Look up the chunk by ID (404 if missing)
  4. Call `getElevenLabsConfig()` — return 503 if not configured
  5. Check `audioCache` for the chunkId. If cached and file exists on disk, read the file and return it with `Content-Type: audio/mpeg` and `Cache-Control: private, max-age=86400`
  6. If cache miss or file missing (clean up stale DB row if needed):
     - Ensure `data/audio/` directory exists (`mkdirSync` with `recursive: true`)
     - Call `generateSpeechStream(chunk.contentText, config)`
     - `tee()` the stream: one copy returns to the client with `Content-Type: audio/mpeg`, the other writes to `data/audio/{chunkId}.mp3` in the background
     - After disk write completes, insert into `audioCache` (id, chunkId, bookId, filePath, voiceId, fileSizeBytes, createdAt)
     - Catch and log background write errors, clean up partial files

  **HEAD handler:**
  - Check if audio exists in `audioCache` for the chunk and the file is on disk
  - Return 200 if cached, 404 if not

**Acceptance criteria:**
- Returns 401 without valid session or token
- Returns 404 for non-existent chunk
- Returns 503 when ElevenLabs is not configured
- Returns cached audio directly when available (no ElevenLabs call)
- Generates and streams new audio on cache miss
- After generation, the file exists at `data/audio/{chunkId}.mp3` and a DB row exists in `audioCache`
- HEAD returns 200 for cached audio, 404 for uncached
- `npm run build` passes

---

## Task 5: Middleware — allow token auth for audio API

**Depends on:** nothing

**Description:**
Update the middleware to let the audio API endpoint through without a session cookie (it handles its own auth via token validation).

**Changes:**
- `src/middleware.ts` — in `isPublicPath()`, add:
  ```
  if (/^\/api\/chunks\/[^/]+\/audio$/.test(pathname)) return true;
  ```

**Acceptance criteria:**
- Requests to `/api/chunks/{id}/audio` pass through middleware without a session cookie
- Other `/api/` routes still require session auth
- `npm run build` passes

---

## Task 6: Audio player component

**Depends on:** Task 4 (needs the audio API to exist)

**Description:**
Create the client-side audio player component for the reading page.

**Changes:**
- New file `src/app/read/[chunkId]/_components/audio-player.tsx`
- `"use client"` component
- Props: `chunkId: string`, `autoplay: boolean`, `token?: string`
- State machine: `idle` → `loading` → `playing` ↔ `paused`, with `error` reachable from `loading`

  **Idle state:**
  - Render a "Listen" button with Headphones icon (from lucide-react)
  - On click → transition to `loading` and call `startPlayback()`

  **Loading state:**
  - Same button but disabled, Loader2 icon with `animate-spin`, text "Generating audio..."
  - If `autoplay=true`, enter this state on mount via `useEffect`

  **Playing/Paused state:**
  - Replace the Listen button with play/pause + rewind (15s) controls
  - Controls slide in with `transition-all duration-300 ease-out` (translate-y-0 + opacity-100)
  - Play/Pause button: primary styled, shows Pause icon when playing, Play icon when paused
  - Rewind button: outline styled, RotateCcw icon, rewinds `currentTime` by 15 seconds

  **Error state:**
  - Show Listen button again (clickable for retry)
  - Inline error message below: red text, "Failed to load audio. Tap to retry."

  **Playback implementation:**
  - Use `new Audio(audioUrl)` where `audioUrl = /api/chunks/{chunkId}/audio` + optional `?token=`
  - Listen for `canplay` → call `audio.play()`, set state to `playing`, trigger control slide-in
  - Listen for `ended` → set state to `paused`
  - Listen for `error` → set state to `error`
  - On unmount: pause audio, clear src

  **Layout:** Wrap in a div with `mx-auto` and `maxWidth: "65ch"` to match the reading content width. Add `mb-6` bottom margin.

**Acceptance criteria:**
- "Listen" button renders in idle state with Headphones icon
- Clicking Listen shows loading spinner, then transitions to play/pause controls when audio loads
- Play/pause toggles audio playback
- Rewind moves back 15 seconds
- Controls slide in with animation (not instant)
- When `autoplay=true`, loading starts immediately on mount
- Error state shows retry option
- Audio stops on component unmount
- Matches existing button styling (Tailwind classes, dark mode support)
- `npm run build` passes

---

## Task 7: Reading page integration

**Depends on:** Task 6

**Description:**
Integrate the AudioPlayer component into the chunk reading page. Only show it when ElevenLabs is configured.

**Changes:**
- `src/app/read/[chunkId]/page.tsx`:
  - Import `settings` from `@/lib/db/schema` and `AudioPlayer` from `./_components/audio-player`
  - Extend `searchParams` type: `Promise<{ token?: string; autoplay?: string }>`
  - Destructure `autoplay` from searchParams alongside `token`
  - After auth check, query settings table for `elevenlabs_api_key`:
    ```ts
    const [elevenLabsKey] = await db.select().from(settings).where(eq(settings.key, "elevenlabs_api_key"));
    const hasElevenLabs = Boolean(elevenLabsKey?.value && JSON.parse(elevenLabsKey.value));
    ```
  - In JSX, render `<AudioPlayer>` between the AI recap and the `<style>` tag / article content:
    ```tsx
    {hasElevenLabs && (
      <AudioPlayer chunkId={chunkId} autoplay={autoplay === "true"} token={token} />
    )}
    ```

**Acceptance criteria:**
- When ElevenLabs API key is configured: Listen button appears above the reading content
- When no API key: no Listen button rendered
- When `?autoplay=true` is in URL: audio begins loading immediately on page load
- Token is passed through to the AudioPlayer for email-link auth
- `npm run build` passes

---

## Task 8: Email digest — add Listen button

**Depends on:** nothing (template change only, no runtime dependency)

**Description:**
Add a "Listen" button to the email digest template that links to the chunk page with `autoplay=true`.

**Changes:**

**`src/lib/email/digest-template.tsx`:**
- Add `listenUrl?: string` to the `BookSection` interface
- After the existing "Read on Web" `<Button>` (line 105-107), add a Listen button:
  - Only render when `book.listenUrl` is truthy
  - Use a `<table>` layout to place both buttons side-by-side (email clients don't support flexbox)
  - Button text: headphone emoji + "Listen" (e.g., `🎧 Listen`)
  - Style: complementary warm brown (`backgroundColor: "#7B6A5F"`), same padding/border-radius as the existing CTA button
  - `href={book.listenUrl}`

**`src/lib/digest.ts`:**
- Import `settings` from the schema
- Before the book loop, check once if ElevenLabs is configured:
  ```ts
  const [elevenLabsKey] = await db.select().from(settings).where(eq(settings.key, "elevenlabs_api_key"));
  const hasElevenLabs = Boolean(elevenLabsKey?.value && JSON.parse(elevenLabsKey.value));
  ```
- In the `bookSections.push()` call (~line 329), add:
  ```ts
  listenUrl: hasElevenLabs ? `${baseUrl}/read/${chunk.id}?token=${token}&autoplay=true` : undefined,
  ```
- Also add `listenUrl` to the `DigestEmailProps.books` type if it's defined separately there

**Acceptance criteria:**
- When ElevenLabs is configured: email digest shows "Listen" button next to "Read on Web"
- When not configured: only "Read on Web" button appears (no empty space)
- Listen button links to the reading page with `?token=...&autoplay=true`
- Button renders correctly in email preview (`/api/digest/preview`)
- `npm run build` passes

---

## Task 9: Audio cleanup on book deletion and completion

**Depends on:** Task 3 (needs `deleteBookAudioFiles`)

**Description:**
Add audio file cleanup when a book is deleted or marked as completed.

**Changes:**

**`src/app/api/books/[id]/route.ts` — DELETE handler:**
- Import `deleteBookAudioFiles` from `@/lib/elevenlabs`
- Before the existing chunk/book deletion logic (before line 138), add:
  ```ts
  await deleteBookAudioFiles(id);
  ```
  This must run before chunks are deleted so the cascade doesn't remove the audioCache rows before we can read the file paths.

**`src/app/api/books/[id]/route.ts` — PATCH handler:**
- After setting `status === "completed"` (after line 118, after the DB update), add:
  ```ts
  if (status === "completed") {
    deleteBookAudioFiles(id).catch((err) => console.error("Audio cleanup failed:", err));
  }
  ```

**`src/app/api/chunks/[id]/read/route.ts`:**
- Import `deleteBookAudioFiles` from `@/lib/elevenlabs`
- After the `bookCompleted = true` block (after line 62), add:
  ```ts
  if (bookCompleted) {
    deleteBookAudioFiles(chunk.bookId).catch((err) => console.error("Audio cleanup failed:", err));
  }
  ```

**Acceptance criteria:**
- Deleting a book removes all its audio files from `data/audio/`
- Marking a book as completed (via PATCH) removes its audio files
- Completing a book by marking its last chunk as read removes its audio files
- Audio cleanup failures don't break the primary delete/complete operations (fire-and-forget with error logging)
- `npm run build` passes

---

## Dependency Graph

```
Task 1 (DB schema)  ──┬──→ Task 3 (ElevenLabs module) ──┬──→ Task 4 (Audio API) ──→ Task 6 (Player component) ──→ Task 7 (Page integration)
                       │                                  │
                       │                                  └──→ Task 9 (Cleanup logic)
                       │
Task 2 (Settings UI)   (independent)
Task 5 (Middleware)    (independent)
Task 8 (Email digest)  (independent)
```

**Parallelizable groups:**
- **Group A (independent):** Tasks 1, 2, 5, 8 can all start immediately
- **Group B (after Task 1):** Task 3
- **Group C (after Task 3):** Tasks 4, 9
- **Group D (after Task 4):** Task 6
- **Group E (after Task 6):** Task 7

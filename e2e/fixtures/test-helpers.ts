import { APIRequestContext } from "@playwright/test";
import path from "path";
import fs from "fs";

// The example.epub lives at the main repo root (/Users/.../MicroRead/example.epub)
// Worktree is at /Users/.../MicroRead/.claude/worktrees/jovial-elgamal/
// From e2e/fixtures/ that's 5 levels up to MicroRead/
function findEpub(): string {
  // Walk up from the project root to find example.epub
  let dir = path.resolve(__dirname, "..", "..");
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "example.epub");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("example.epub not found - place it in the main MicroRead repo root");
}

export const EPUB_PATH = findEpub();

export async function deleteAllBooks(request: APIRequestContext) {
  const response = await request.get("/api/books");
  const books = await response.json();
  for (const book of books) {
    await request.delete(`/api/books/${book.id}`);
  }
}

export async function uploadBook(
  request: APIRequestContext,
  status: "active" | "queued" = "active",
  chunkSize = 1000
): Promise<{ id: string; title: string; author: string; totalChunks: number }> {
  const fs = await import("fs");
  const fileBuffer = fs.readFileSync(EPUB_PATH);

  const response = await request.post("/api/books", {
    multipart: {
      epub: {
        name: "example.epub",
        mimeType: "application/epub+zip",
        buffer: fileBuffer,
      },
      chunkSize: String(chunkSize),
      status,
    },
  });

  if (!response.ok()) {
    throw new Error(`Upload failed: ${response.status()} ${await response.text()}`);
  }

  return response.json();
}

export async function getFirstChunkId(
  request: APIRequestContext,
  bookId: string
): Promise<string> {
  const response = await request.get(`/api/books/${bookId}`);
  const data = await response.json();
  // The book detail API returns chapters with chunkIds
  const chapters = data.chapters;
  if (chapters && chapters.length > 0 && chapters[0].chunkIds.length > 0) {
    return chapters[0].chunkIds[0];
  }
  throw new Error("No chunks found for book");
}

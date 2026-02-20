import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteBookAudioFiles } from "@/lib/elevenlabs";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Parse optional body
  let readVia: "email_link" | "web_app" | "manual_trigger" = "web_app";
  try {
    const body = await request.json();
    if (body.readVia) {
      readVia = body.readVia;
    }
  } catch {
    // No body or invalid JSON — use default
  }

  // Look up the chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));

  if (!chunk) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  // Insert reading_log entry
  await db.insert(readingLog).values({
    id: crypto.randomUUID(),
    chunkId: chunk.id,
    bookId: chunk.bookId,
    readAt: new Date().toISOString(),
    readVia,
  });

  // Look up the book
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, chunk.bookId));

  let bookCompleted = false;

  // If this chunk is at or ahead of current progress, advance
  if (chunk.index >= book.currentChunkIndex) {
    const newIndex = chunk.index + 1;

    if (newIndex >= book.totalChunks) {
      // Book is completed
      bookCompleted = true;
      await db
        .update(books)
        .set({
          currentChunkIndex: newIndex,
          status: "completed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(books.id, chunk.bookId));
    } else {
      await db
        .update(books)
        .set({ currentChunkIndex: newIndex })
        .where(eq(books.id, chunk.bookId));
    }
  }

  if (bookCompleted) {
    deleteBookAudioFiles(chunk.bookId).catch((err) =>
      console.error("Audio cleanup failed:", err)
    );
  }

  // Find the next chunk
  const [nextChunk] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(
      and(eq(chunks.bookId, chunk.bookId), eq(chunks.index, chunk.index + 1))
    );

  return NextResponse.json({
    success: true,
    bookCompleted,
    nextChunkId: nextChunk?.id ?? null,
  });
}

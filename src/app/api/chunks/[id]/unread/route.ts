import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up the chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));

  if (!chunk) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  // Delete all reading_log entries for this chunk
  await db
    .delete(readingLog)
    .where(
      and(eq(readingLog.chunkId, chunk.id), eq(readingLog.bookId, chunk.bookId))
    );

  // Look up the book
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, chunk.bookId));

  // If this chunk is before current progress, reset currentChunkIndex
  if (chunk.index < book.currentChunkIndex) {
    const updates: Record<string, unknown> = {
      currentChunkIndex: chunk.index,
    };

    // If book was completed, revert to active
    if (book.status === "completed") {
      updates.status = "active";
      updates.completedAt = null;
    }

    await db.update(books).set(updates).where(eq(books.id, chunk.bookId));
  } else if (book.status === "completed") {
    // Current chunk was the last one — revert completion
    await db
      .update(books)
      .set({
        currentChunkIndex: chunk.index,
        status: "active",
        completedAt: null,
      })
      .where(eq(books.id, chunk.bookId));
  }

  return NextResponse.json({ success: true });
}

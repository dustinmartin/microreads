import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";

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

  // Find all chunk IDs at or after this chunk's index (same book)
  const chunksToUnread = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(and(eq(chunks.bookId, chunk.bookId), gte(chunks.index, chunk.index)));

  const chunkIdsToUnread = chunksToUnread.map((c) => c.id);

  // Delete reading_log entries for this chunk and all subsequent chunks
  await db
    .delete(readingLog)
    .where(
      and(
        eq(readingLog.bookId, chunk.bookId),
        inArray(readingLog.chunkId, chunkIdsToUnread)
      )
    );

  // Look up the book
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, chunk.bookId));

  // Reset currentChunkIndex to this chunk's position
  if (chunk.index <= book.currentChunkIndex || book.status === "completed") {
    const updates: Record<string, unknown> = {
      currentChunkIndex: chunk.index,
    };

    if (book.status === "completed") {
      updates.status = "active";
      updates.completedAt = null;
    }

    await db.update(books).set(updates).where(eq(books.id, chunk.bookId));
  }

  return NextResponse.json({ success: true });
}

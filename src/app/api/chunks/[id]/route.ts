import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));

  if (!chunk) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  // Fetch the book
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, chunk.bookId));

  // Fetch previous chunk (same book, index - 1)
  const [prevChunk] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(
      and(eq(chunks.bookId, chunk.bookId), eq(chunks.index, chunk.index - 1))
    );

  // Fetch next chunk (same book, index + 1)
  const [nextChunk] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(
      and(eq(chunks.bookId, chunk.bookId), eq(chunks.index, chunk.index + 1))
    );

  return NextResponse.json({
    id: chunk.id,
    contentHtml: chunk.contentHtml,
    chapterTitle: chunk.chapterTitle,
    index: chunk.index,
    wordCount: chunk.wordCount,
    aiRecap: chunk.aiRecap,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      totalChunks: book.totalChunks,
    },
    prevChunkId: prevChunk?.id ?? null,
    nextChunkId: nextChunk?.id ?? null,
  });
}

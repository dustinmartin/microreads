import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the book
  const [book] = await db.select().from(books).where(eq(books.id, id));

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Fetch all chunks for this book, ordered by index
  const allChunks = await db
    .select()
    .from(chunks)
    .where(eq(chunks.bookId, id))
    .orderBy(chunks.index);

  // Build chapter list: group chunks by chapterTitle
  const chapterMap = new Map<
    string,
    { title: string; chunkIndices: number[]; chunkIds: string[]; status: "read" | "unread" | "partial" }
  >();

  for (const chunk of allChunks) {
    const title = chunk.chapterTitle ?? "Untitled";
    if (!chapterMap.has(title)) {
      chapterMap.set(title, { title, chunkIndices: [], chunkIds: [], status: "unread" });
    }
    const chapter = chapterMap.get(title)!;
    chapter.chunkIndices.push(chunk.index);
    chapter.chunkIds.push(chunk.id);
  }

  // Determine read/unread status for each chapter
  const chapters = Array.from(chapterMap.values()).map((chapter) => {
    const readCount = chapter.chunkIndices.filter(
      (idx) => idx < book.currentChunkIndex
    ).length;
    const totalCount = chapter.chunkIndices.length;

    let status: "read" | "unread" | "partial" = "unread";
    if (readCount === totalCount) {
      status = "read";
    } else if (readCount > 0) {
      status = "partial";
    }

    return {
      title: chapter.title,
      chunkIndices: chapter.chunkIndices,
      chunkIds: chapter.chunkIds,
      status,
      readCount,
      totalCount,
    };
  });

  // Compute reading stats
  const chunksRead = book.currentChunkIndex;
  const wordsRead = allChunks
    .filter((c) => c.index < book.currentChunkIndex)
    .reduce((sum, c) => sum + c.wordCount, 0);

  const addedDate = new Date(book.addedAt);
  const endDate = book.completedAt ? new Date(book.completedAt) : new Date();
  const daysActive = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // Estimated completion: remaining chunks / 1 chunk per day, added to today
  const remainingChunks = book.totalChunks - book.currentChunkIndex;
  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + remainingChunks);

  const stats = {
    chunksRead,
    wordsRead,
    daysActive,
    estimatedCompletion: estimatedCompletion.toISOString(),
  };

  return NextResponse.json({
    book,
    chapters,
    stats,
  });
}

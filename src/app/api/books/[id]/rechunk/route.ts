import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { parseEpub } from "@/lib/epub";
import { chunkBook } from "@/lib/chunker";
import path from "node:path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await request.json();
  const { chunkSize } = body as { chunkSize: number };

  if (!chunkSize || chunkSize < 300 || chunkSize > 3000) {
    return NextResponse.json(
      { error: "chunkSize must be between 300 and 3000" },
      { status: 400 }
    );
  }

  try {
    // 1. Get the epub path and re-parse the entire epub
    const epubPath = path.resolve(process.cwd(), book.epubPath);
    const parsed = await parseEpub(epubPath, id);

    // 2. Re-chunk with new size
    const newChunks = chunkBook(parsed.chapters, chunkSize);

    // 3. Delete all chunks with index > currentChunkIndex
    await db
      .delete(chunks)
      .where(
        and(eq(chunks.bookId, id), gt(chunks.index, book.currentChunkIndex))
      );

    // 4. Insert new chunks starting from currentChunkIndex + 1
    const chunksToInsert = newChunks.slice(book.currentChunkIndex + 1);

    if (chunksToInsert.length > 0) {
      const chunkRows = chunksToInsert.map((chunk, i) => ({
        id: crypto.randomUUID(),
        bookId: id,
        index: book.currentChunkIndex + 1 + i,
        chapterTitle: chunk.chapterTitle,
        contentHtml: chunk.contentHtml,
        contentText: chunk.contentText,
        wordCount: chunk.wordCount,
      }));

      await db.insert(chunks).values(chunkRows);
    }

    // 5. Update the book's chunkSizeWords and totalChunks
    // Total chunks = already-read chunks (0..currentChunkIndex) + current chunk + new remaining chunks
    const newTotalChunks = book.currentChunkIndex + 1 + chunksToInsert.length;

    await db
      .update(books)
      .set({
        chunkSizeWords: chunkSize,
        totalChunks: newTotalChunks,
      })
      .where(eq(books.id, id));

    return NextResponse.json({
      success: true,
      totalChunks: newTotalChunks,
    });
  } catch (error) {
    console.error("Rechunk failed:", error);
    return NextResponse.json(
      { error: "Failed to rechunk book" },
      { status: 500 }
    );
  }
}

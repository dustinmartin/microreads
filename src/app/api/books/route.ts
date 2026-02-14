import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { parseEpub } from "@/lib/epub";
import { chunkBook } from "@/lib/chunker";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const allBooks = await db.select().from(books);

  const statusOrder: Record<string, number> = {
    active: 0,
    queued: 1,
    completed: 2,
    paused: 3,
  };

  const result = allBooks
    .map((book) => ({
      ...book,
      progress:
        book.totalChunks > 0
          ? Math.round((book.currentChunkIndex / book.totalChunks) * 100)
          : 0,
      chunksRead: book.currentChunkIndex,
    }))
    .sort(
      (a, b) =>
        (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const epubFile = formData.get("epub");
    if (!epubFile || !(epubFile instanceof File)) {
      return NextResponse.json(
        { error: "An epub file is required" },
        { status: 400 }
      );
    }

    const chunkSizeRaw = formData.get("chunkSize");
    const chunkSize = chunkSizeRaw ? Number(chunkSizeRaw) : 1000;
    if (isNaN(chunkSize) || chunkSize <= 0) {
      return NextResponse.json(
        { error: "chunkSize must be a positive number" },
        { status: 400 }
      );
    }

    const statusRaw = formData.get("status");
    const status: "active" | "queued" =
      statusRaw === "active" ? "active" : "queued";

    // Generate a unique book ID
    const bookId = crypto.randomUUID();

    // Save the uploaded epub to disk
    const epubsDir = path.resolve(process.cwd(), "data", "epubs");
    fs.mkdirSync(epubsDir, { recursive: true });

    const epubPath = path.join(epubsDir, `${bookId}.epub`);
    const arrayBuffer = await epubFile.arrayBuffer();
    fs.writeFileSync(epubPath, Buffer.from(arrayBuffer));

    // Parse the epub for metadata and chapters
    const parsed = await parseEpub(epubPath, bookId);

    // Chunk the book
    const bookChunks = chunkBook(parsed.chapters, chunkSize);

    // Insert the book row
    const now = new Date().toISOString();
    await db.insert(books).values({
      id: bookId,
      title: parsed.title,
      author: parsed.author,
      coverImage: parsed.coverPath,
      epubPath: `data/epubs/${bookId}.epub`,
      chunkSizeWords: chunkSize,
      status,
      totalChunks: bookChunks.length,
      currentChunkIndex: 0,
      addedAt: now,
    });

    // Batch-insert all chunk rows
    if (bookChunks.length > 0) {
      const chunkRows = bookChunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        bookId,
        index,
        chapterTitle: chunk.chapterTitle,
        contentHtml: chunk.contentHtml,
        contentText: chunk.contentText,
        wordCount: chunk.wordCount,
      }));

      await db.insert(chunks).values(chunkRows);
    }

    return NextResponse.json({
      id: bookId,
      title: parsed.title,
      author: parsed.author,
      totalChunks: bookChunks.length,
      status,
    });
  } catch (error) {
    console.error("Book upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process epub upload" },
      { status: 500 }
    );
  }
}

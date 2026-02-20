import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildChapterRuns } from "@/lib/chapter-runs";
import { deleteBookAudioFiles } from "@/lib/elevenlabs";
import fs from "node:fs";
import path from "node:path";

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

  // Build chapter list as contiguous title runs
  const chapters = buildChapterRuns(allChunks).map((chapter) => {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status, restart } = body as {
    status?: "active" | "paused" | "queued" | "completed";
    restart?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (restart) {
    updates.currentChunkIndex = 0;
    updates.status = "active";
    updates.completedAt = null;
  } else if (status) {
    updates.status = status;
    if (status === "completed") {
      updates.completedAt = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(books).set(updates).where(eq(books.id, id));
  }

  if (status === "completed") {
    deleteBookAudioFiles(id).catch((err) =>
      console.error("Audio cleanup failed:", err)
    );
  }

  const [updatedBook] = await db.select().from(books).where(eq(books.id, id));

  return NextResponse.json(updatedBook);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Delete audio files first (before chunks are deleted, since audioCache references chunk data)
  await deleteBookAudioFiles(id);

  // Delete reading_log entries first (before chunks cascade deletes them)
  await db.delete(readingLog).where(eq(readingLog.bookId, id));

  // Delete all chunks for this book
  await db.delete(chunks).where(eq(chunks.bookId, id));

  // Delete the book row
  await db.delete(books).where(eq(books.id, id));

  // Delete epub file from disk
  try {
    const epubPath = path.resolve(process.cwd(), book.epubPath);
    if (fs.existsSync(epubPath)) {
      fs.unlinkSync(epubPath);
    }
  } catch {
    // File might not exist, ignore
  }

  // Delete cover image from disk
  if (book.coverImage) {
    try {
      const coverPath = path.resolve(process.cwd(), book.coverImage);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    } catch {
      // File might not exist, ignore
    }
  }

  return NextResponse.json({ success: true });
}

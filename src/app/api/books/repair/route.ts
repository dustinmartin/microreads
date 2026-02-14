import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analyzeBookChunkIntegrity, rechunkBook } from "@/lib/rechunk-book";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    bookId?: string;
    dryRun?: boolean;
    limit?: number;
  };

  const dryRun = body.dryRun ?? true;

  let candidates: Array<{ id: string; title: string; chunkSizeWords: number }>;

  if (body.bookId) {
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
        chunkSizeWords: books.chunkSizeWords,
      })
      .from(books)
      .where(eq(books.id, body.bookId));
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    candidates = [book];
  } else {
    candidates = await db
      .select({
        id: books.id,
        title: books.title,
        chunkSizeWords: books.chunkSizeWords,
      })
      .from(books);
  }

  const limitedCandidates =
    body.limit && body.limit > 0 ? candidates.slice(0, body.limit) : candidates;

  const reports = await Promise.all(
    limitedCandidates.map((book) => analyzeBookChunkIntegrity(book.id))
  );
  const flagged = reports.filter(
    (report): report is NonNullable<typeof report> =>
      report !== null && report.issues.length > 0
  );

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      checked: limitedCandidates.length,
      flaggedCount: flagged.length,
      flagged,
    });
  }

  const repaired: Array<{
    bookId: string;
    title: string;
    totalChunks: number;
    currentChunkIndex: number;
  }> = [];

  for (const report of flagged) {
    const candidate = limitedCandidates.find((book) => book.id === report.bookId);
    if (!candidate) continue;

    const result = await rechunkBook(candidate.id, candidate.chunkSizeWords);
    repaired.push({
      bookId: candidate.id,
      title: candidate.title,
      totalChunks: result.totalChunks,
      currentChunkIndex: result.currentChunkIndex,
    });
  }

  return NextResponse.json({
    success: true,
    dryRun: false,
    checked: limitedCandidates.length,
    flaggedCount: flagged.length,
    repairedCount: repaired.length,
    repaired,
  });
}

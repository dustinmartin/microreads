import crypto from "node:crypto";
import path from "node:path";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { parseEpub } from "@/lib/epub";
import { chunkBook } from "@/lib/chunker";
import { eq } from "drizzle-orm";

type ChunkRow = {
  id: string;
  index: number;
  wordCount: number;
  chapterTitle: string | null;
};

type ChunkRange = Omit<ChunkRow, "chapterTitle"> & {
  start: number;
  end: number;
};

type LogRow = {
  id: string;
  chunkId: string;
  bookId: string;
  sentAt: string | null;
  readAt: string | null;
  readVia: "email_link" | "web_app" | "manual_trigger" | null;
};

export type RechunkResult = {
  totalChunks: number;
  currentChunkIndex: number;
  rechunkMode: "full_rebuild";
  progressRemapped: boolean;
  readLogRemapped: boolean;
};

export type IntegrityIssue =
  | "count_mismatch"
  | "index_gap"
  | "title_non_contiguous"
  | "mixed_regime_near_progress";

export type IntegrityReport = {
  bookId: string;
  title: string;
  chunkSizeWords: number;
  issues: IntegrityIssue[];
};

function buildRanges(
  rows: Array<{ id: string; index: number; wordCount: number }>
): ChunkRange[] {
  let cursor = 0;
  const sorted = [...rows].sort((a, b) => a.index - b.index);
  return sorted.map((row) => {
    const start = cursor;
    const end = start + Math.max(0, row.wordCount);
    cursor = end;
    return { ...row, start, end };
  });
}

function progressWordsAtIndex(
  ranges: ChunkRange[],
  currentChunkIndex: number
): number {
  let words = 0;
  for (const range of ranges) {
    if (range.index >= currentChunkIndex) break;
    words += range.wordCount;
  }
  return words;
}

function mapProgressToIndex(ranges: ChunkRange[], wordsRead: number): number {
  if (ranges.length === 0) return 0;

  let index = 0;
  for (const range of ranges) {
    if (range.end <= wordsRead) {
      index = range.index + 1;
      continue;
    }
    break;
  }
  return Math.min(index, ranges.length);
}

function overlap(a: ChunkRange, b: ChunkRange): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function findRangeForOffset(ranges: ChunkRange[], offset: number): ChunkRange {
  if (ranges.length === 0) {
    throw new Error("Cannot map offset without ranges");
  }

  for (const range of ranges) {
    if (offset < range.end) return range;
  }

  return ranges[ranges.length - 1];
}

function mapChunkIdsByOverlap(
  oldRanges: ChunkRange[],
  newRanges: ChunkRange[]
): Map<string, string> {
  const mapped = new Map<string, string>();

  if (newRanges.length === 0) return mapped;

  for (const oldRange of oldRanges) {
    let best: ChunkRange | null = null;
    let bestOverlap = -1;

    for (const newRange of newRanges) {
      const score = overlap(oldRange, newRange);
      if (score > bestOverlap) {
        bestOverlap = score;
        best = newRange;
      }
    }

    if (best && bestOverlap > 0) {
      mapped.set(oldRange.id, best.id);
      continue;
    }

    const mid = oldRange.start + oldRange.wordCount / 2;
    mapped.set(oldRange.id, findRangeForOffset(newRanges, mid).id);
  }

  return mapped;
}

function hasIndexGaps(rows: ChunkRow[]): boolean {
  if (rows.length === 0) return false;
  const sorted = [...rows].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].index !== i) return true;
  }
  return false;
}

function hasNonContiguousTitleRuns(
  rows: ChunkRow[],
  currentChunkIndex: number
): boolean {
  // Ignore distant unread suffixes (many books include samples/previews with
  // repeated chapter names that are not near active progress).
  const sorted = [...rows]
    .sort((a, b) => a.index - b.index)
    .filter((row) => row.index <= currentChunkIndex + 25);
  const titles = new Set<string>();
  let prevTitle = "";

  for (const row of sorted) {
    const title = row.chapterTitle ?? "Untitled";
    if (title === prevTitle) continue;
    if (titles.has(title)) return true;
    titles.add(title);
    prevTitle = title;
  }

  return false;
}

function hasMixedRegimeNearProgress(
  rows: ChunkRow[],
  currentChunkIndex: number
): boolean {
  if (rows.length < 12) return false;

  const sorted = [...rows].sort((a, b) => a.index - b.index);
  const before = sorted
    .filter(
      (row) =>
        row.index < currentChunkIndex &&
        row.index >= Math.max(0, currentChunkIndex - 8)
    )
    .map((row) => row.wordCount);
  const after = sorted
    .filter((row) => row.index > currentChunkIndex && row.index <= currentChunkIndex + 8)
    .map((row) => row.wordCount);

  if (before.length < 4 || after.length < 4) return false;

  const avgBefore = before.reduce((sum, n) => sum + n, 0) / before.length;
  const avgAfter = after.reduce((sum, n) => sum + n, 0) / after.length;
  const ratio = Math.max(avgBefore, avgAfter) / Math.max(1, Math.min(avgBefore, avgAfter));

  return ratio >= 1.5;
}

export async function analyzeBookChunkIntegrity(
  bookId: string
): Promise<IntegrityReport | null> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) return null;

  const allChunks = await db
    .select({
      id: chunks.id,
      index: chunks.index,
      wordCount: chunks.wordCount,
      chapterTitle: chunks.chapterTitle,
    })
    .from(chunks)
    .where(eq(chunks.bookId, bookId))
    .orderBy(chunks.index);

  const issues: IntegrityIssue[] = [];

  if (allChunks.length !== book.totalChunks) {
    issues.push("count_mismatch");
  }

  if (hasIndexGaps(allChunks)) {
    issues.push("index_gap");
  }

  if (hasNonContiguousTitleRuns(allChunks, book.currentChunkIndex)) {
    issues.push("title_non_contiguous");
  }

  if (hasMixedRegimeNearProgress(allChunks, book.currentChunkIndex)) {
    issues.push("mixed_regime_near_progress");
  }

  return {
    bookId: book.id,
    title: book.title,
    chunkSizeWords: book.chunkSizeWords,
    issues,
  };
}

export async function rechunkBook(
  bookId: string,
  chunkSize: number
): Promise<RechunkResult> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    throw new Error("Book not found");
  }

  const epubPath = path.resolve(process.cwd(), book.epubPath);
  const parsed = await parseEpub(epubPath, bookId);

  const oldChunks = await db
    .select({
      id: chunks.id,
      index: chunks.index,
      wordCount: chunks.wordCount,
    })
    .from(chunks)
    .where(eq(chunks.bookId, bookId))
    .orderBy(chunks.index);

  const oldLogs = await db
    .select({
      id: readingLog.id,
      chunkId: readingLog.chunkId,
      bookId: readingLog.bookId,
      sentAt: readingLog.sentAt,
      readAt: readingLog.readAt,
      readVia: readingLog.readVia,
    })
    .from(readingLog)
    .where(eq(readingLog.bookId, bookId));

  const rebuiltChunks = chunkBook(parsed.chapters, chunkSize);
  const newChunkRows = rebuiltChunks.map((chunk, index) => ({
    id: crypto.randomUUID(),
    bookId,
    index,
    chapterTitle: chunk.chapterTitle,
    contentHtml: chunk.contentHtml,
    contentText: chunk.contentText,
    wordCount: chunk.wordCount,
  }));

  const oldRanges = buildRanges(oldChunks);
  const newRanges = buildRanges(
    newChunkRows.map((row) => ({
      id: row.id,
      index: row.index,
      wordCount: row.wordCount,
    }))
  );

  const wordsRead = progressWordsAtIndex(oldRanges, book.currentChunkIndex);
  const newCurrentChunkIndex = mapProgressToIndex(newRanges, wordsRead);
  const chunkIdMap = mapChunkIdsByOverlap(oldRanges, newRanges);

  const remappedLogs = oldLogs
    .map((log): LogRow | null => {
      const newChunkId = chunkIdMap.get(log.chunkId);
      if (!newChunkId) return null;
      return {
        id: log.id,
        chunkId: newChunkId,
        bookId,
        sentAt: log.sentAt,
        readAt: log.readAt,
        readVia: log.readVia,
      };
    })
    .filter((row): row is LogRow => row !== null);

  const newTotalChunks = newChunkRows.length;
  const clampedCurrent = Math.min(newCurrentChunkIndex, newTotalChunks);
  const isCompleted = newTotalChunks > 0 && clampedCurrent >= newTotalChunks;

  db.transaction((tx) => {
    tx.delete(readingLog).where(eq(readingLog.bookId, bookId)).run();
    tx.delete(chunks).where(eq(chunks.bookId, bookId)).run();

    if (newChunkRows.length > 0) {
      tx.insert(chunks).values(newChunkRows).run();
    }

    if (remappedLogs.length > 0) {
      tx.insert(readingLog).values(remappedLogs).run();
    }

    tx
      .update(books)
      .set({
        chunkSizeWords: chunkSize,
        totalChunks: newTotalChunks,
        currentChunkIndex: clampedCurrent,
        status: isCompleted
          ? "completed"
          : book.status === "completed"
            ? "active"
            : book.status,
        completedAt: isCompleted ? book.completedAt ?? new Date().toISOString() : null,
      })
      .where(eq(books.id, bookId))
      .run();
  });

  return {
    totalChunks: newTotalChunks,
    currentChunkIndex: clampedCurrent,
    rechunkMode: "full_rebuild",
    progressRemapped: true,
    readLogRemapped: true,
  };
}

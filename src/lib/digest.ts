import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and, desc, asc, gte, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { DigestEmail } from "@/lib/email/digest-template";
import type { DigestEmailProps } from "@/lib/email/digest-template";
import { createElement } from "react";

interface DigestResult {
  sent: boolean;
  bookCount: number;
  error?: string;
}

function generateTeaser(contentText: string): string {
  const words = contentText.split(/\s+/).filter(Boolean);
  const teaserWords = words.slice(0, 100);
  return teaserWords.join(" ") + (words.length > 100 ? "..." : "");
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Calculate the current reading streak: consecutive days backwards from today
 * where there is at least one reading_log entry with readAt set.
 */
async function calculateStreak(): Promise<number> {
  // Get all distinct dates with readAt set, ordered descending
  const logs = await db
    .select({ readAt: readingLog.readAt })
    .from(readingLog)
    .where(sql`${readingLog.readAt} IS NOT NULL`)
    .orderBy(desc(readingLog.readAt));

  if (logs.length === 0) return 0;

  // Extract unique dates
  const uniqueDates = new Set<string>();
  for (const log of logs) {
    if (log.readAt) {
      uniqueDates.add(log.readAt.split("T")[0]);
    }
  }

  const sortedDates = Array.from(uniqueDates).sort().reverse();

  let streak = 0;
  const today = new Date();
  // Start checking from today
  const checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (sortedDates.includes(dateStr)) {
      streak++;
    } else {
      // Allow skipping today if no reading yet, but start counting from yesterday
      if (i === 0) {
        // Today has no reading yet, check from yesterday
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Check if digest was already sent today (for idempotency).
 */
export async function alreadySentToday(): Promise<boolean> {
  const today = todayDateString();
  const existing = await db
    .select({ id: readingLog.id })
    .from(readingLog)
    .where(sql`${readingLog.sentAt} LIKE ${today + "%"}`)
    .limit(1);

  return existing.length > 0;
}

/**
 * Build the digest email props without side effects.
 */
export async function buildDigestProps(): Promise<{
  props: DigestEmailProps;
  chunkDetails: Array<{
    chunkId: string;
    bookId: string;
    wordCount: number;
    isLastChunk: boolean;
  }>;
} | null> {
  const baseUrl = getBaseUrl();
  const today = todayDateString();

  // Query all active books
  const activeBooks = await db
    .select()
    .from(books)
    .where(eq(books.status, "active"));

  if (activeBooks.length === 0) {
    return null;
  }

  const bookSections: DigestEmailProps["books"] = [];
  const chunkDetails: Array<{
    chunkId: string;
    bookId: string;
    wordCount: number;
    isLastChunk: boolean;
  }> = [];

  let totalWordCount = 0;

  for (const book of activeBooks) {
    // Get the next unread chunk (the chunk at index === currentChunkIndex)
    const [chunk] = await db
      .select()
      .from(chunks)
      .where(
        and(
          eq(chunks.bookId, book.id),
          eq(chunks.index, book.currentChunkIndex)
        )
      )
      .limit(1);

    if (!chunk) continue;

    const teaser = generateTeaser(chunk.contentText);
    const progress =
      book.totalChunks > 0
        ? Math.round((book.currentChunkIndex / book.totalChunks) * 100)
        : 0;

    const coverUrl = book.coverImage
      ? `${baseUrl}/${book.coverImage}`
      : null;

    bookSections.push({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl,
      chapterTitle: chunk.chapterTitle || "Untitled Chapter",
      progress,
      teaser,
      readUrl: `${baseUrl}/read/${chunk.id}`,
    });

    const isLastChunk = book.currentChunkIndex >= book.totalChunks - 1;

    chunkDetails.push({
      chunkId: chunk.id,
      bookId: book.id,
      wordCount: chunk.wordCount,
      isLastChunk,
    });

    totalWordCount += chunk.wordCount;
  }

  if (bookSections.length === 0) {
    return null;
  }

  const totalReadingMinutes = Math.max(1, Math.round(totalWordCount / 250));
  const streak = await calculateStreak();

  const props: DigestEmailProps = {
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    books: bookSections,
    streak,
    totalReadingMinutes,
    libraryUrl: baseUrl,
  };

  return { props, chunkDetails };
}

/**
 * Send the daily digest email.
 */
export async function sendDailyDigest(): Promise<DigestResult> {
  try {
    const emailTo = process.env.EMAIL_TO;
    if (!emailTo) {
      return { sent: false, bookCount: 0, error: "EMAIL_TO env var not set" };
    }

    const result = await buildDigestProps();

    if (!result) {
      return { sent: false, bookCount: 0 };
    }

    const { props, chunkDetails } = result;
    const now = new Date().toISOString();

    // Create reading_log entries with sentAt for each chunk being sent
    for (const detail of chunkDetails) {
      await db.insert(readingLog).values({
        id: crypto.randomUUID(),
        chunkId: detail.chunkId,
        bookId: detail.bookId,
        sentAt: now,
        readAt: null,
        readVia: null,
      });
    }

    // Advance currentChunkIndex for each book
    for (const detail of chunkDetails) {
      const book = await db
        .select()
        .from(books)
        .where(eq(books.id, detail.bookId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!book) continue;

      const newIndex = book.currentChunkIndex + 1;

      if (detail.isLastChunk) {
        // Book is completed
        await db
          .update(books)
          .set({
            currentChunkIndex: newIndex,
            status: "completed",
            completedAt: now,
          })
          .where(eq(books.id, detail.bookId));

        // Auto-activate the next queued book (lowest addedAt)
        const [nextQueued] = await db
          .select()
          .from(books)
          .where(eq(books.status, "queued"))
          .orderBy(asc(books.addedAt))
          .limit(1);

        if (nextQueued) {
          await db
            .update(books)
            .set({ status: "active" })
            .where(eq(books.id, nextQueued.id));
        }
      } else {
        await db
          .update(books)
          .set({ currentChunkIndex: newIndex })
          .where(eq(books.id, detail.bookId));
      }
    }

    // Compose and send the email
    const element = createElement(DigestEmail, props);
    const subject = `Your Micro Reads - ${props.date}`;

    await sendEmail(emailTo, subject, element);

    return { sent: true, bookCount: props.books.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send daily digest:", message);
    return { sent: false, bookCount: 0, error: message };
  }
}

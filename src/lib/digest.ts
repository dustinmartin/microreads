import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { DigestEmail } from "@/lib/email/digest-template";
import type { DigestEmailProps } from "@/lib/email/digest-template";
import { createElement } from "react";
import { generateChunkToken } from "@/lib/tokens";

interface MailAttachment {
  filename: string;
  path: string;
  cid: string;
  contentType: string;
}

function buildCoverAttachment(
  coverImage: string,
  bookId: string
): MailAttachment | null {
  const filePath = path.join(process.cwd(), coverImage);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return {
    filename: `cover-${bookId}${ext}`,
    path: filePath,
    cid: `cover-${bookId}`,
    contentType: mimeTypes[ext] ?? "image/jpeg",
  };
}

interface DigestResult {
  sent: boolean;
  bookCount: number;
  error?: string;
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
  attachments: MailAttachment[];
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
  const attachments: MailAttachment[] = [];

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

    const progress =
      book.totalChunks > 0
        ? Math.round((book.currentChunkIndex / book.totalChunks) * 100)
        : 0;

    let coverUrl: string | null = null;
    if (book.coverImage) {
      const attachment = buildCoverAttachment(book.coverImage, book.id);
      if (attachment) {
        attachments.push(attachment);
        coverUrl = `cid:${attachment.cid}`;
      }
    }

    const token = generateChunkToken(chunk.id);

    bookSections.push({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl,
      chapterTitle: chunk.chapterTitle || "Untitled Chapter",
      progress,
      chunkHtml: chunk.contentHtml,
      readUrl: `${baseUrl}/read/${chunk.id}?token=${token}`,
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

  return { props, chunkDetails, attachments };
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

    const { props, chunkDetails, attachments } = result;
    const now = new Date().toISOString();

    // Create reading_log entries with sentAt for each chunk being sent
    for (const detail of chunkDetails) {
      await db.insert(readingLog).values({
        id: crypto.randomUUID(),
        chunkId: detail.chunkId,
        bookId: detail.bookId,
        sentAt: now,
        readAt: now,
        readVia: "email_link",
      });
    }

    // Advance currentChunkIndex for each delivered+read chunk
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
        await db
          .update(books)
          .set({
            currentChunkIndex: newIndex,
            status: "completed",
            completedAt: now,
          })
          .where(eq(books.id, detail.bookId));

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

    await sendEmail(emailTo, subject, element, attachments);

    return { sent: true, bookCount: props.books.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send daily digest:", message);
    return { sent: false, bookCount: 0, error: message };
  }
}

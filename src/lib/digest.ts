import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { books, chunks, readingLog, settings } from "@/lib/db/schema";
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

const INLINE_CHUNK_IMAGE_CAP = 6;

const imageMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

interface InlineImageState {
  attachments: MailAttachment[];
  attachmentsByPath: Map<string, MailAttachment>;
  localImageCount: number;
  embeddedCount: number;
  skippedCount: number;
}

function createInlineImageState(): InlineImageState {
  return {
    attachments: [],
    attachmentsByPath: new Map<string, MailAttachment>(),
    localImageCount: 0,
    embeddedCount: 0,
    skippedCount: 0,
  };
}

function isPathWithinDir(baseDir: string, candidatePath: string): boolean {
  const relative = path.relative(baseDir, candidatePath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sanitizeImgSrc(src: string): string {
  let value = src.trim();

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return "";
    }
  } else {
    const queryIndex = value.indexOf("?");
    if (queryIndex >= 0) value = value.slice(0, queryIndex);
    const hashIndex = value.indexOf("#");
    if (hashIndex >= 0) value = value.slice(0, hashIndex);
  }

  return value;
}

function resolveLocalBookImagePath(src: string, bookId: string): string | null {
  const pathname = sanitizeImgSrc(src);
  if (!pathname) return null;

  const prefix = `/api/book-images/${bookId}/`;
  if (!pathname.startsWith(prefix)) return null;

  let relativePath = pathname.slice(prefix.length).replace(/^\/+/, "");
  if (!relativePath) return null;

  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    // Keep original relative path if decoding fails.
  }

  return relativePath;
}

function buildInlineChunkAttachment(
  absolutePath: string,
  bookId: string,
  state: InlineImageState
): MailAttachment | null {
  const existing = state.attachmentsByPath.get(absolutePath);
  if (existing) return existing;

  if (state.embeddedCount >= INLINE_CHUNK_IMAGE_CAP) {
    state.skippedCount += 1;
    return null;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const suffix = ext || ".img";
  const ordinal = state.embeddedCount + 1;

  const attachment: MailAttachment = {
    filename: `chunk-${bookId}-${ordinal}${suffix}`,
    path: absolutePath,
    cid: `chunk-${bookId}-${ordinal}`,
    contentType: imageMimeTypes[ext] ?? "application/octet-stream",
  };

  state.attachmentsByPath.set(absolutePath, attachment);
  state.attachments.push(attachment);
  state.embeddedCount += 1;
  return attachment;
}

function rewriteChunkHtmlWithInlineCids(
  chunkHtml: string,
  bookId: string,
  state: InlineImageState
): string {
  const baseDir = path.resolve(process.cwd(), "data", "book-images", bookId);
  const imgTagRegex = /<img\b[^>]*>/gi;
  const srcAttrRegex = /\bsrc\s*=\s*(["'])(.*?)\1/i;

  return chunkHtml.replace(imgTagRegex, (tag) => {
    const srcMatch = tag.match(srcAttrRegex);
    if (!srcMatch) return tag;

    const quote = srcMatch[1];
    const src = srcMatch[2];
    const relativePath = resolveLocalBookImagePath(src, bookId);
    if (!relativePath) return tag;

    state.localImageCount += 1;

    const absolutePath = path.resolve(baseDir, relativePath);
    if (!isPathWithinDir(baseDir, absolutePath)) {
      state.skippedCount += 1;
      return tag;
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      state.skippedCount += 1;
      return tag;
    }

    const attachment = buildInlineChunkAttachment(absolutePath, bookId, state);
    if (!attachment) return tag;

    const cidSrc = `cid:${attachment.cid}`;
    return tag.replace(srcAttrRegex, `src=${quote}${cidSrc}${quote}`);
  });
}

function buildCoverAttachment(
  coverImage: string,
  bookId: string
): MailAttachment | null {
  const filePath = path.join(process.cwd(), coverImage);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  return {
    filename: `cover-${bookId}${ext}`,
    path: filePath,
    cid: `cover-${bookId}`,
    contentType: imageMimeTypes[ext] ?? "image/jpeg",
  };
}

interface DigestResult {
  sent: boolean;
  bookCount: number;
  error?: string;
}

function getBaseUrl(): string {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
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
  const inlineImageState = createInlineImageState();

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
    const chunkHtml = rewriteChunkHtmlWithInlineCids(
      chunk.contentHtml,
      book.id,
      inlineImageState
    );

    bookSections.push({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl,
      chapterTitle: chunk.chapterTitle || "Untitled Chapter",
      progress,
      chunkHtml,
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

  attachments.push(...inlineImageState.attachments);
  if (inlineImageState.localImageCount > 0) {
    console.info(
      "Digest inline images:",
      `found=${inlineImageState.localImageCount}`,
      `embedded=${inlineImageState.embeddedCount}`,
      `skipped=${inlineImageState.skippedCount}`
    );
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
 * Get the recipient email from the settings table, falling back to EMAIL_TO env var.
 */
export async function getEmailTo(): Promise<string | undefined> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "email_to"))
    .limit(1)
    .then((rows) => rows[0]);

  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (typeof parsed === "string" && parsed) return parsed;
    } catch {
      if (row.value) return row.value;
    }
  }

  return process.env.EMAIL_TO;
}

/**
 * Send the daily digest email.
 */
export async function sendDailyDigest(): Promise<DigestResult> {
  try {
    const emailTo = await getEmailTo();
    if (!emailTo) {
      return { sent: false, bookCount: 0, error: "No recipient email configured" };
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

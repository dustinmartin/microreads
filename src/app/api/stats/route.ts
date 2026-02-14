import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

function computeStreaks(dates: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // dates should be unique sorted YYYY-MM-DD strings in ascending order
  const uniqueDates = [...new Set(dates)].sort();

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1] + "T00:00:00");
    const curr = new Date(uniqueDates[i] + "T00:00:00");
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentRun++;
    } else {
      currentRun = 1;
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  // Current streak: count consecutive days backwards from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const lastDate = uniqueDates[uniqueDates.length - 1];
  if (lastDate !== todayStr && lastDate !== yesterdayStr) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  let checkDate = new Date(lastDate + "T00:00:00");

  for (let i = uniqueDates.length - 2; i >= 0; i--) {
    const expectedPrev = new Date(checkDate);
    expectedPrev.setDate(expectedPrev.getDate() - 1);
    const expectedStr = expectedPrev.toISOString().slice(0, 10);

    if (uniqueDates[i] === expectedStr) {
      currentStreak++;
      checkDate = expectedPrev;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

export async function GET() {
  try {
    // Total books completed
    const completedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(eq(books.status, "completed"));
    const totalBooksCompleted = completedResult[0]?.count ?? 0;

    // Total words read: sum wordCount from chunks where chunk.index < book.currentChunkIndex
    const wordsResult = await db
      .select({ total: sql<number>`coalesce(sum(${chunks.wordCount}), 0)` })
      .from(chunks)
      .innerJoin(books, eq(chunks.bookId, books.id))
      .where(lt(chunks.index, books.currentChunkIndex));
    const totalWordsRead = wordsResult[0]?.total ?? 0;

    // Get all reading dates for streak calculation
    const readDates = await db
      .select({
        date: sql<string>`date(${readingLog.readAt})`,
      })
      .from(readingLog)
      .where(sql`${readingLog.readAt} is not null`);

    const dateStrings = readDates
      .map((r) => r.date)
      .filter((d): d is string => d !== null);

    const { currentStreak, longestStreak } = computeStreaks(dateStrings);

    return NextResponse.json({
      totalBooksCompleted,
      totalWordsRead,
      currentStreak,
      longestStreak,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

import Link from "next/link";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { BookCheck, Type, Flame, Trophy, ArrowLeft } from "lucide-react";

// --- Data fetching helpers ---

function computeStreaks(dates: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

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

function formatWords(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

async function getStats() {
  const completedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(books)
    .where(eq(books.status, "completed"));
  const totalBooksCompleted = completedResult[0]?.count ?? 0;

  const wordsResult = await db
    .select({ total: sql<number>`coalesce(sum(${chunks.wordCount}), 0)` })
    .from(chunks)
    .innerJoin(books, eq(chunks.bookId, books.id))
    .where(lt(chunks.index, books.currentChunkIndex));
  const totalWordsRead = wordsResult[0]?.total ?? 0;

  const readDates = await db
    .select({ date: sql<string>`date(${readingLog.readAt})` })
    .from(readingLog)
    .where(sql`${readingLog.readAt} is not null`);

  const dateStrings = readDates
    .map((r) => r.date)
    .filter((d): d is string => d !== null);

  const { currentStreak, longestStreak } = computeStreaks(dateStrings);

  return { totalBooksCompleted, totalWordsRead, currentStreak, longestStreak };
}

async function getCalendarData(): Promise<Map<string, number>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearAgo = new Date(today);
  yearAgo.setDate(yearAgo.getDate() - 365);
  const yearAgoStr = yearAgo.toISOString().slice(0, 10);

  const results = await db
    .select({
      date: sql<string>`date(${readingLog.readAt})`,
      count: sql<number>`count(*)`,
    })
    .from(readingLog)
    .where(
      sql`${readingLog.readAt} is not null and date(${readingLog.readAt}) >= ${yearAgoStr}`
    )
    .groupBy(sql`date(${readingLog.readAt})`)
    .orderBy(sql`date(${readingLog.readAt})`);

  const map = new Map<string, number>();
  for (const r of results) {
    map.set(r.date, r.count);
  }
  return map;
}

async function getWordsPerDay(): Promise<{ date: string; words: number }[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const startStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const results = await db
    .select({
      date: sql<string>`date(${readingLog.readAt})`,
      words: sql<number>`coalesce(sum(${chunks.wordCount}), 0)`,
    })
    .from(readingLog)
    .innerJoin(chunks, eq(readingLog.chunkId, chunks.id))
    .where(
      sql`${readingLog.readAt} is not null and date(${readingLog.readAt}) >= ${startStr}`
    )
    .groupBy(sql`date(${readingLog.readAt})`)
    .orderBy(sql`date(${readingLog.readAt})`);

  const map = new Map<string, number>();
  for (const r of results) {
    map.set(r.date, r.words);
  }

  // Fill all 30 days
  const days: { date: string; words: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, words: map.get(ds) ?? 0 });
  }
  return days;
}

// --- Calendar heatmap helpers ---

function buildCalendarGrid(calendarData: Map<string, number>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Go back to find the start: 52 full weeks before end-of-this-week
  // End on Saturday of this week (or today's day of week)
  const todayDow = today.getDay(); // 0=Sun
  // We want 53 columns (52 full weeks + partial current week)
  // Start from the Sunday that is ~52 weeks ago
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364 - todayDow);

  const weeks: { date: string; count: number; dayOfWeek: number }[][] = [];
  let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const ds = cursor.toISOString().slice(0, 10);
    const dow = cursor.getDay();
    currentWeek.push({
      date: ds,
      count: calendarData.get(ds) ?? 0,
      dayOfWeek: dow,
    });
    if (dow === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return { weeks, startDate, endDate };
}

function getMonthLabels(
  weeks: { date: string; count: number; dayOfWeek: number }[][]
) {
  const months: { label: string; colIndex: number }[] = [];
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  let lastMonth = -1;

  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0];
    if (!firstDay) continue;
    const month = new Date(firstDay.date + "T00:00:00").getMonth();
    if (month !== lastMonth) {
      months.push({ label: monthNames[month], colIndex: w });
      lastMonth = month;
    }
  }
  return months;
}

function heatColor(count: number): string {
  if (count === 0) return "bg-stone-200 dark:bg-stone-800";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900";
  if (count === 2) return "bg-emerald-400 dark:bg-emerald-700";
  if (count <= 4) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
}

// --- Page component ---

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getStats();
  const calendarData = await getCalendarData();
  const wordsPerDay = await getWordsPerDay();
  const { weeks } = buildCalendarGrid(calendarData);
  const monthLabels = getMonthLabels(weeks);
  const maxWords = Math.max(...wordsPerDay.map((d) => d.words), 1);

  const statCards = [
    {
      label: "Books Completed",
      value: stats.totalBooksCompleted.toString(),
      icon: BookCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Words Read",
      value: formatWords(stats.totalWordsRead),
      icon: Type,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Current Streak",
      value: `${stats.currentStreak} days`,
      icon: Flame,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    },
    {
      label: "Longest Streak",
      value: `${stats.longestStreak} days`,
      icon: Trophy,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1A1A1A]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground dark:hover:bg-stone-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Reading Stats
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your reading activity at a glance
        </p>

        {/* Stat cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reading calendar heatmap */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">
            Reading Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 365 days of reading activity
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4">
            {/* Month labels */}
            <div className="flex" style={{ paddingLeft: "28px" }}>
              {monthLabels.map((m, i) => {
                const nextCol =
                  i + 1 < monthLabels.length
                    ? monthLabels[i + 1].colIndex
                    : weeks.length;
                const span = nextCol - m.colIndex;
                return (
                  <div
                    key={`${m.label}-${m.colIndex}`}
                    className="text-xs text-muted-foreground"
                    style={{ width: `${span * 15}px`, flexShrink: 0 }}
                  >
                    {m.label}
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="mt-1 flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 pr-1">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                  <div
                    key={i}
                    className="flex h-[12px] w-[22px] items-center justify-end text-[9px] text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {Array.from({ length: 7 }).map((_, di) => {
                    const day = week.find((d) => d.dayOfWeek === di);
                    if (!day) {
                      return (
                        <div key={di} className="h-[12px] w-[12px]" />
                      );
                    }
                    return (
                      <div
                        key={di}
                        className={`h-[12px] w-[12px] rounded-sm ${heatColor(day.count)}`}
                        title={`${day.date}: ${day.count} reading${day.count !== 1 ? "s" : ""}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="h-[12px] w-[12px] rounded-sm bg-stone-200 dark:bg-stone-800" />
              <div className="h-[12px] w-[12px] rounded-sm bg-emerald-200 dark:bg-emerald-900" />
              <div className="h-[12px] w-[12px] rounded-sm bg-emerald-400 dark:bg-emerald-700" />
              <div className="h-[12px] w-[12px] rounded-sm bg-emerald-500 dark:bg-emerald-600" />
              <div className="h-[12px] w-[12px] rounded-sm bg-emerald-600 dark:bg-emerald-500" />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Words per day bar chart */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">
            Words Per Day
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 30 days of reading volume
          </p>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-40 items-end gap-[3px]">
              {wordsPerDay.map((day) => {
                const heightPct =
                  maxWords > 0 ? (day.words / maxWords) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    style={{ height: "100%" }}
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                      {day.date}: {day.words.toLocaleString()} words
                    </div>
                    <div
                      className={`w-full rounded-t-sm transition-colors ${
                        day.words > 0
                          ? "bg-emerald-500 dark:bg-emerald-600 group-hover:bg-emerald-400 dark:group-hover:bg-emerald-500"
                          : "bg-stone-200 dark:bg-stone-800"
                      }`}
                      style={{
                        height: `${Math.max(heightPct, day.words > 0 ? 4 : 2)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Date labels */}
            <div className="mt-2 flex gap-[3px]">
              {wordsPerDay.map((day, i) => {
                // Show label every 7 days
                const showLabel = i % 7 === 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 text-center text-[9px] text-muted-foreground"
                  >
                    {showLabel
                      ? new Date(day.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )
                      : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

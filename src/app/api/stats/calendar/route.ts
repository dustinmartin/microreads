import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingLog } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
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

    return NextResponse.json(
      results.map((r) => ({ date: r.date, count: r.count }))
    );
  } catch (error) {
    console.error("Stats calendar API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar data" },
      { status: 500 }
    );
  }
}

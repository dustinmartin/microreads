import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(settings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  for (const [key, val] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value: JSON.stringify(val) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(val) },
      });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";

export async function GET() {
  const allBooks = await db.select().from(books);

  const statusOrder: Record<string, number> = {
    active: 0,
    queued: 1,
    completed: 2,
    paused: 3,
  };

  const result = allBooks
    .map((book) => ({
      ...book,
      progress:
        book.totalChunks > 0
          ? Math.round((book.currentChunkIndex / book.totalChunks) * 100)
          : 0,
      chunksRead: book.currentChunkIndex,
    }))
    .sort(
      (a, b) =>
        (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    );

  return NextResponse.json(result);
}

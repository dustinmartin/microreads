import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rechunkBook } from "@/lib/rechunk-book";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [book] = await db.select().from(books).where(eq(books.id, id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await request.json();
  const { chunkSize } = body as { chunkSize: number };

  if (!chunkSize || chunkSize < 300 || chunkSize > 3000) {
    return NextResponse.json(
      { error: "chunkSize must be between 300 and 3000" },
      { status: 400 }
    );
  }

  try {
    const result = await rechunkBook(id, chunkSize);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Rechunk failed:", error);
    return NextResponse.json(
      { error: "Failed to rechunk book" },
      { status: 500 }
    );
  }
}

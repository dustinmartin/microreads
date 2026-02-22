import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunks } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAiConfig, chatCompletion } from "@/lib/ai";
import { buildChapterRuns } from "@/lib/chapter-runs";

async function isSessionValid(request: NextRequest): Promise<boolean> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return true;
  const session = request.cookies.get("session")?.value;
  if (!session) return false;
  const { createHmac } = await import("crypto");
  const hmac = createHmac("sha256", authSecret);
  hmac.update("authenticated");
  return session === hmac.digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!(await isSessionValid(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAiConfig();
  if (!config) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // Fetch current chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));
  if (!chunk) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  // Return cached summary if available
  if (chunk.aiRecap) {
    return NextResponse.json({
      summary: chunk.aiRecap,
      chapterTitle: chunk.chapterTitle ?? "",
    });
  }

  // Fetch all chunks for this book ordered by index
  const allChunks = await db
    .select({
      id: chunks.id,
      index: chunks.index,
      chapterTitle: chunks.chapterTitle,
      contentText: chunks.contentText,
    })
    .from(chunks)
    .where(eq(chunks.bookId, chunk.bookId))
    .orderBy(asc(chunks.index));

  const runs = buildChapterRuns(allChunks);

  // Find which run contains the current chunk
  const currentRunIndex = runs.findIndex((r) => r.chunkIds.includes(id));
  if (currentRunIndex === -1) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 500 });
  }

  const currentRun = runs[currentRunIndex];
  let gatherChunkIds: string[];
  let chapterTitle: string;

  const isFirstInChapter = currentRun.chunkIds[0] === id;

  if (!isFirstInChapter) {
    // Gather chunks from same chapter with index < current
    const currentIdx = currentRun.chunkIds.indexOf(id);
    gatherChunkIds = currentRun.chunkIds.slice(0, currentIdx);
    chapterTitle = currentRun.title;
  } else if (currentRunIndex > 0) {
    // First chunk of chapter — summarize previous chapter
    const prevRun = runs[currentRunIndex - 1];
    gatherChunkIds = prevRun.chunkIds;
    chapterTitle = prevRun.title;
  } else {
    // First chunk of first chapter
    return NextResponse.json(
      { error: "No prior content to summarize" },
      { status: 400 },
    );
  }

  // Build text from gathered chunks
  const chunkMap = new Map(allChunks.map((c) => [c.id, c.contentText]));
  let text = gatherChunkIds.map((cid) => chunkMap.get(cid) ?? "").join("\n\n");

  // Smart truncation: keep last 24,000 chars
  const MAX_CHARS = 24_000;
  let truncated = false;
  if (text.length > MAX_CHARS) {
    truncated = true;
    text = text.slice(-MAX_CHARS);
    // Trim to nearest paragraph break
    const paragraphBreak = text.indexOf("\n\n");
    if (paragraphBreak !== -1 && paragraphBreak < 1000) {
      text = text.slice(paragraphBreak + 2);
    }
  }

  const userMessage = truncated
    ? `Summarize the chapter "${chapterTitle}" (note: the beginning has been trimmed for length; this is the most recent portion):\n\n${text}`
    : `Summarize the chapter "${chapterTitle}":\n\n${text}`;

  try {
    const summary = await chatCompletion(config, [
      {
        role: "system",
        content:
          "You are a reading companion summarizing book chapters. Write a concise summary in 2-4 sentences. Use present tense. Focus on key events, character developments, and important details. Do not reveal anything beyond the provided text. Write in a neutral, literary style.",
      },
      { role: "user", content: userMessage },
    ]);

    // Cache the summary
    await db.update(chunks).set({ aiRecap: summary }).where(eq(chunks.id, id));

    return NextResponse.json({ summary, chapterTitle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI summary generation failed:", message);
    return NextResponse.json(
      { error: "Summary generation failed", detail: message },
      { status: 502 },
    );
  }
}

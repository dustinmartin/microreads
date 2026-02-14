import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AiRecap } from "./ai-recap";
import { verifyChunkToken } from "@/lib/tokens";
import { cookies } from "next/headers";

async function isSessionValid(): Promise<boolean> {
  try {
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) return true; // No auth configured, allow through

    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return false;

    // Replicate the middleware's HMAC check
    const { createHmac } = await import("crypto");
    const hmac = createHmac("sha256", authSecret);
    hmac.update("authenticated");
    const expected = hmac.digest("hex");
    return session === expected;
  } catch {
    return false;
  }
}

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ chunkId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { chunkId } = await params;
  const { token } = await searchParams;

  // Check authentication: either a valid session cookie or a valid token
  const hasValidSession = await isSessionValid();
  const hasValidToken = token ? verifyChunkToken(token, chunkId) : false;

  if (!hasValidSession && !hasValidToken) {
    redirect("/login");
  }

  // Fetch the chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, chunkId));

  if (!chunk) {
    notFound();
  }

  // Fetch the book
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, chunk.bookId));

  if (!book) {
    notFound();
  }

  // Fetch previous chunk ID
  const [prevChunk] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(
      and(eq(chunks.bookId, chunk.bookId), eq(chunks.index, chunk.index - 1))
    );

  // Fetch next chunk ID
  const [nextChunk] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(
      and(eq(chunks.bookId, chunk.bookId), eq(chunks.index, chunk.index + 1))
    );

  const chunkNumber = chunk.index + 1;
  const progressPercent =
    book.totalChunks > 0 ? (chunk.index / book.totalChunks) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1A1A1A]">
      {/* Top bar */}
      <header className="border-b border-[#E8E4DC]/30 dark:border-[#E8E4DC]/10">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-medium text-[#2C2C2C] dark:text-[#E8E4DC]">
                {book.title}
              </h1>
              {chunk.chapterTitle && (
                <p className="mt-0.5 truncate text-xs text-[#2C2C2C]/60 dark:text-[#E8E4DC]/50">
                  {chunk.chapterTitle}
                </p>
              )}
            </div>
            <span className="ml-4 flex-shrink-0 text-xs text-[#2C2C2C]/50 dark:text-[#E8E4DC]/40">
              Chunk {chunkNumber} of {book.totalChunks}
            </span>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* AI Recap block */}
        {chunk.aiRecap && <AiRecap recap={chunk.aiRecap} />}

        {/* Reading content */}
        <article
          className="prose-reader mx-auto"
          style={{ maxWidth: "60ch" }}
          dangerouslySetInnerHTML={{ __html: chunk.contentHtml }}
        />

        {/* Navigation */}
        <nav
          className="mx-auto mt-12 flex items-center justify-between border-t border-[#2C2C2C]/10 pt-6 dark:border-[#E8E4DC]/10"
          style={{ maxWidth: "60ch" }}
        >
          {prevChunk ? (
            <Link
              href={`/read/${prevChunk.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-[#2C2C2C]/70 transition-colors hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] dark:text-[#E8E4DC]/70 dark:hover:bg-[#E8E4DC]/5 dark:hover:text-[#E8E4DC]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <div />
          )}

          {nextChunk ? (
            <Link
              href={`/read/${nextChunk.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-[#2C2C2C]/70 transition-colors hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] dark:text-[#E8E4DC]/70 dark:hover:bg-[#E8E4DC]/5 dark:hover:text-[#E8E4DC]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="text-sm text-[#2C2C2C]/50 dark:text-[#E8E4DC]/40">
              End of book
            </div>
          )}
        </nav>
      </main>

      {/* Progress bar at very bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-[#2C2C2C]/5 dark:bg-[#E8E4DC]/5">
        <div
          className="h-full bg-[#2C2C2C]/20 transition-all dark:bg-[#E8E4DC]/20"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

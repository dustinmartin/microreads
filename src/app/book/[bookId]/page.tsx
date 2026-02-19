import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { books, chunks, readingLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildChapterRuns } from "@/lib/chapter-runs";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Calendar,
  BookOpenCheck,
  BarChart3,
  Clock,
} from "lucide-react";
import BookControls from "./_components/book-controls";
import ChunkSizeControl from "./_components/chunk-size-control";
import ChunkGrid from "./_components/chunk-grid";
import CollapsibleChapter from "./_components/collapsible-chapter";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;

  // Fetch the book
  const [book] = await db.select().from(books).where(eq(books.id, bookId));

  if (!book) {
    notFound();
  }

  // Fetch all chunks for this book, ordered by index
  const allChunks = await db
    .select()
    .from(chunks)
    .where(eq(chunks.bookId, bookId))
    .orderBy(chunks.index);

  // Fetch reading_log entries for this book to detect skip-ahead reads
  const logEntries = await db
    .select({ chunkId: readingLog.chunkId })
    .from(readingLog)
    .where(eq(readingLog.bookId, bookId));
  const readChunkIds = new Set(logEntries.map((e) => e.chunkId));

  // Build chapter list by contiguous title runs
  const chapters = buildChapterRuns(allChunks).map((chapter) => {
    const readCount = chapter.chunkIds.filter(
      (id, i) =>
        chapter.chunkIndices[i] < book.currentChunkIndex ||
        readChunkIds.has(id)
    ).length;
    const totalCount = chapter.chunkIndices.length;

    let status: "read" | "unread" | "partial" = "unread";
    if (readCount === totalCount) {
      status = "read";
    } else if (readCount > 0) {
      status = "partial";
    }

    return {
      ...chapter,
      status,
      readCount,
      totalCount,
    };
  });

  // Reading stats
  const chunksRead = book.currentChunkIndex;
  const wordsRead = allChunks
    .filter(
      (c) => c.index < book.currentChunkIndex || readChunkIds.has(c.id)
    )
    .reduce((sum, c) => sum + c.wordCount, 0);

  const addedDate = new Date(book.addedAt);
  const endDate = book.completedAt ? new Date(book.completedAt) : new Date();
  const daysActive = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const remainingChunks = book.totalChunks - book.currentChunkIndex;
  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + remainingChunks);

  const progress =
    book.totalChunks > 0
      ? Math.round((book.currentChunkIndex / book.totalChunks) * 100)
      : 0;

  const statusStyles: Record<string, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    queued:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    completed:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
    paused:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  };

  const formattedAddedDate = addedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEstCompletion = estimatedCompletion.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Book header */}
        <div className="flex gap-6">
          {/* Cover */}
          <div className="relative h-36 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#2C2C2C]/5 shadow-md sm:h-48 sm:w-32 dark:bg-[#E8E4DC]/5 dark:ring-1 dark:ring-white/10">
            {book.coverImage ? (
              <img
                src={`/api/${book.coverImage}`}
                alt={`Cover of ${book.title}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-12 w-12 text-[#2C2C2C]/20 dark:text-[#E8E4DC]/20" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-1 flex-col justify-between py-1">
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] dark:text-[#E8E4DC]">
                {book.title}
              </h1>
              <p className="mt-1 text-base text-[#2C2C2C]/60 dark:text-[#E8E4DC]/50">
                {book.author}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[book.status] ?? statusStyles.queued}`}
                >
                  {book.status}
                </span>
                <span className="text-xs text-[#2C2C2C]/40 dark:text-[#E8E4DC]/30">
                  Added {formattedAddedDate}
                </span>
              </div>
            </div>

            {/* Book controls */}
            <div className="mt-3">
              <BookControls bookId={bookId} status={book.status} />
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[#2C2C2C]/60 dark:text-[#E8E4DC]/50">
                <span>{progress}% complete</span>
                <span>
                  {chunksRead} / {book.totalChunks} chunks
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#2C2C2C]/5 dark:bg-[#E8E4DC]/5">
                <div
                  className="h-full rounded-full bg-emerald-500/70 transition-all dark:bg-emerald-400/70"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            label="Chunks Read"
            value={`${chunksRead} / ${book.totalChunks}`}
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Words Read"
            value={wordsRead.toLocaleString()}
          />
          <StatCard
            icon={<Calendar className="h-5 w-5" />}
            label="Days Active"
            value={String(daysActive)}
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Est. Completion"
            value={
              book.status === "completed" ? "Done" : formattedEstCompletion
            }
          />
        </div>

        {/* Chunk size control */}
        <div className="mt-6">
          <ChunkSizeControl bookId={bookId} currentSize={book.chunkSizeWords} />
        </div>

        {/* Chapter list */}
        <section className="mt-10">
          <h2 className="font-serif text-lg font-semibold text-[#2C2C2C] dark:text-[#E8E4DC]">
            Chapters
          </h2>
          <div className="mt-4 space-y-2">
            {chapters.map((chapter, chapterIdx) => {
              const isCurrent = chapter.chunkIndices.some(
                (idx) => idx === book.currentChunkIndex
              );

              return (
                <div
                  key={chapterIdx}
                  className="rounded-xl border border-[#2C2C2C]/8 bg-white/60 dark:border-[#E8E4DC]/8 dark:bg-white/[0.02]"
                >
                  <CollapsibleChapter
                    defaultOpen={isCurrent || chapter.status === "partial"}
                    header={
                      <>
                        {chapter.status === "read" ? (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                        ) : chapter.status === "partial" ? (
                          <CircleDot className="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                        ) : (
                          <Circle className="h-5 w-5 flex-shrink-0 text-[#2C2C2C]/20 dark:text-[#E8E4DC]/20" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-medium text-[#2C2C2C] dark:text-[#E8E4DC]">
                            {chapter.title}
                          </h3>
                          <p className="text-xs text-[#2C2C2C]/40 dark:text-[#E8E4DC]/30">
                            {chapter.readCount} / {chapter.totalCount} chunks read
                          </p>
                        </div>
                      </>
                    }
                  >
                    <ChunkGrid
                      chunkIds={chapter.chunkIds}
                      chunkIndices={chapter.chunkIndices}
                      readChunkIds={chapter.chunkIds.filter(
                        (id, i) =>
                          chapter.chunkIndices[i] < book.currentChunkIndex ||
                          readChunkIds.has(id)
                      )}
                      currentChunkIndex={book.currentChunkIndex}
                    />
                  </CollapsibleChapter>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#2C2C2C]/8 bg-white/60 p-4 dark:border-[#E8E4DC]/8 dark:bg-white/[0.02]">
      <div className="text-[#2C2C2C]/30 dark:text-[#E8E4DC]/30">{icon}</div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-[#2C2C2C] dark:text-[#E8E4DC]">
        {value}
      </p>
      <p className="font-serif text-xs text-[#2C2C2C]/50 dark:text-[#E8E4DC]/40">
        {label}
      </p>
    </div>
  );
}

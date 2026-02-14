import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { books, chunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  ArrowLeft,
  Calendar,
  BookOpenCheck,
  BarChart3,
  Clock,
} from "lucide-react";
import BookControls from "./_components/book-controls";
import ChunkSizeControl from "./_components/chunk-size-control";

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

  // Build chapter list grouped by chapterTitle
  const chapterMap = new Map<
    string,
    {
      title: string;
      chunkIndices: number[];
      chunkIds: string[];
    }
  >();

  for (const chunk of allChunks) {
    const title = chunk.chapterTitle ?? "Untitled";
    if (!chapterMap.has(title)) {
      chapterMap.set(title, { title, chunkIndices: [], chunkIds: [] });
    }
    const chapter = chapterMap.get(title)!;
    chapter.chunkIndices.push(chunk.index);
    chapter.chunkIds.push(chunk.id);
  }

  const chapters = Array.from(chapterMap.values()).map((chapter) => {
    const readCount = chapter.chunkIndices.filter(
      (idx) => idx < book.currentChunkIndex
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
    .filter((c) => c.index < book.currentChunkIndex)
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
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1A1A1A]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#2C2C2C]/60 transition-colors hover:text-[#2C2C2C] dark:text-[#E8E4DC]/50 dark:hover:text-[#E8E4DC]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Link>

        {/* Book header */}
        <div className="mt-6 flex gap-6">
          {/* Cover */}
          <div className="relative h-48 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-[#2C2C2C]/5 shadow-md dark:bg-[#E8E4DC]/5">
            {book.coverImage ? (
              <Image
                src={book.coverImage}
                alt={`Cover of ${book.title}`}
                fill
                className="object-cover"
                sizes="128px"
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
              <h1 className="text-2xl font-bold tracking-tight text-[#2C2C2C] dark:text-[#E8E4DC]">
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
          <h2 className="text-lg font-semibold text-[#2C2C2C] dark:text-[#E8E4DC]">
            Chapters
          </h2>
          <div className="mt-4 space-y-2">
            {chapters.map((chapter, chapterIdx) => (
              <div
                key={chapterIdx}
                className="rounded-xl border border-[#2C2C2C]/8 bg-white/60 dark:border-[#E8E4DC]/8 dark:bg-white/[0.02]"
              >
                {/* Chapter header */}
                <div className="flex items-center gap-3 px-4 py-3">
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
                </div>

                {/* Chunk links */}
                <div className="border-t border-[#2C2C2C]/5 px-4 py-2 dark:border-[#E8E4DC]/5">
                  <div className="flex flex-wrap gap-1.5">
                    {chapter.chunkIndices.map((idx, i) => {
                      const isRead = idx < book.currentChunkIndex;
                      const isCurrent = idx === book.currentChunkIndex;
                      return (
                        <Link
                          key={chapter.chunkIds[i]}
                          href={`/read/${chapter.chunkIds[i]}`}
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-colors ${
                            isCurrent
                              ? "bg-emerald-500 text-white shadow-sm dark:bg-emerald-400 dark:text-[#1A1A1A]"
                              : isRead
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                : "bg-[#2C2C2C]/5 text-[#2C2C2C]/50 hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]/70 dark:bg-[#E8E4DC]/5 dark:text-[#E8E4DC]/40 dark:hover:bg-[#E8E4DC]/10"
                          }`}
                        >
                          {idx + 1}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
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
      <p className="mt-2 text-lg font-semibold text-[#2C2C2C] dark:text-[#E8E4DC]">
        {value}
      </p>
      <p className="text-xs text-[#2C2C2C]/50 dark:text-[#E8E4DC]/40">
        {label}
      </p>
    </div>
  );
}

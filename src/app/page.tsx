import Link from "next/link";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { BookOpen, Plus } from "lucide-react";
import { CompletedSection } from "./_components/completed-section";

type Book = typeof books.$inferSelect;

function getProgress(book: Book): number {
  if (book.totalChunks === 0) return 0;
  return Math.round((book.currentChunkIndex / book.totalChunks) * 100);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    queued:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    completed:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
    paused:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  };

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.queued}`}
    >
      {status}
    </span>
  );
}

function BookCard({ book }: { book: Book }) {
  const progress = getProgress(book);

  return (
    <Link
      href={`/book/${book.id}`}
      className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Cover image or placeholder */}
      <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted dark:ring-1 dark:ring-white/10">
        {book.coverImage ? (
          <img
            src={`/api/${book.coverImage}`}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Book info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="line-clamp-2 font-serif text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {book.author}
          </p>
        </div>

        <div className="mt-2 space-y-1.5">
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {progress}% complete
            </span>
            <StatusBadge status={book.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function BookGrid({ bookList }: { bookList: Book[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {bookList.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
      <BookOpen className="h-12 w-12 text-muted-foreground/40" />
      <p className="mt-4 text-sm text-muted-foreground">
        Your library is empty
      </p>
      <Link
        href="/upload"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        Upload your first book
      </Link>
    </div>
  );
}

export default async function Home() {
  const allBooks = await db.select().from(books);

  const activeBooks = allBooks.filter(
    (b) => b.status === "active" || b.status === "paused"
  );
  const queuedBooks = allBooks.filter((b) => b.status === "queued");
  const completedBooks = allBooks.filter((b) => b.status === "completed");

  const hasBooks = allBooks.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Library
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your reading collection
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Upload Book
          </Link>
        </div>

        {/* Content */}
        {!hasBooks ? (
          <div className="mt-12">
            <EmptyState />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Active section */}
            {activeBooks.length > 0 && (
              <section>
                <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
                  Active
                </h2>
                <BookGrid bookList={activeBooks} />
              </section>
            )}

            {/* Queued section */}
            {queuedBooks.length > 0 && (
              <section>
                <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
                  Queued
                </h2>
                <BookGrid bookList={queuedBooks} />
              </section>
            )}

            {/* Completed section - collapsed by default */}
            {completedBooks.length > 0 && (
              <section>
                <CompletedSection>
                  <BookGrid bookList={completedBooks} />
                </CompletedSection>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowLeft } from "lucide-react";

interface ReadingActionsProps {
  chunkId: string;
  bookId: string;
  nextChunkId: string | null;
}

export function ReadingActions({
  chunkId,
  bookId,
  nextChunkId,
}: ReadingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkRead() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chunks/${chunkId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readVia: "web_app" }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark as read");
      }

      if (nextChunkId) {
        router.push(`/read/${nextChunkId}`);
      } else {
        router.push(`/book/${bookId}`);
      }
    } catch (err) {
      console.error("Error marking chunk as read:", err);
      setError("Failed to save progress. Try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="mx-auto mt-12 border-t border-[#2C2C2C]/10 pt-6 dark:border-[#E8E4DC]/10"
      style={{ maxWidth: "60ch" }}
    >
      {error && (
        <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/book/${bookId}`)}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-[#2C2C2C]/70 transition-colors hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] dark:text-[#E8E4DC]/70 dark:hover:bg-[#E8E4DC]/5 dark:hover:text-[#E8E4DC]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Book
        </button>

        <button
          onClick={handleMarkRead}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {loading
            ? "Saving..."
            : nextChunkId
              ? "Mark Read & Next"
              : "Mark Read & Finish"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

interface MarkAsReadButtonProps {
  chunkId: string;
  nextChunkId: string | null;
}

export function MarkAsReadButton({
  chunkId,
  nextChunkId,
}: MarkAsReadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/chunks/${chunkId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readVia: "web_app" }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark as read");
      }

      const data = await res.json();

      if (data.bookCompleted) {
        setCompleted(true);
        setTimeout(() => {
          setCompleted(false);
        }, 3000);
      } else if (data.nextChunkId) {
        router.push(`/read/${data.nextChunkId}`);
      }
    } catch (error) {
      console.error("Error marking chunk as read:", error);
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-6 py-3 text-emerald-800 font-semibold">
        <Check className="h-5 w-5" />
        Book completed!
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-white font-semibold shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Check className="h-5 w-5" />
      )}
      {loading ? "Marking..." : "Mark as Read"}
    </button>
  );
}

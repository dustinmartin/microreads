"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";

export default function ChunkSizeControl({
  bookId,
  currentSize,
}: {
  bookId: string;
  currentSize: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(currentSize);
  const [loading, setLoading] = useState(false);

  async function applyChunkSize() {
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}/rechunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkSize: size }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#2C2C2C]/60 dark:text-[#E8E4DC]/50">
        Chunk size: <strong className="text-[#2C2C2C] dark:text-[#E8E4DC]">{currentSize}</strong> words
      </span>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#2C2C2C]/5 px-3 py-2 text-xs font-medium min-h-[44px] text-[#2C2C2C]/70 transition-colors hover:bg-[#2C2C2C]/10 dark:bg-[#E8E4DC]/5 dark:text-[#E8E4DC]/60 dark:hover:bg-[#E8E4DC]/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Adjust
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <input
            type="range"
            inputMode="numeric"
            min={300}
            max={3000}
            step={50}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-1.5 w-36 cursor-pointer accent-emerald-500"
          />
          <span className="min-w-[3.5rem] text-xs tabular-nums text-[#2C2C2C]/60 dark:text-[#E8E4DC]/50">
            {size} words
          </span>
          <button
            onClick={applyChunkSize}
            disabled={loading || size === currentSize}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium min-h-[44px] text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-400 dark:text-[#1A1A1A] dark:hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {loading ? "Applying..." : "Apply"}
          </button>
          <button
            onClick={() => {
              setSize(currentSize);
              setOpen(false);
            }}
            className="rounded-lg px-3 py-2 text-xs min-h-[44px] text-[#2C2C2C]/50 hover:text-[#2C2C2C]/80 dark:text-[#E8E4DC]/40 dark:hover:text-[#E8E4DC]/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

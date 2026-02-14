"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { useTransition } from "react";

interface ChunkGridProps {
  chunkIds: string[];
  chunkIndices: number[];
  readChunkIds: string[];
  currentChunkIndex: number;
}

export default function ChunkGrid({
  chunkIds,
  chunkIndices,
  readChunkIds,
  currentChunkIndex,
}: ChunkGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const readSet = new Set(readChunkIds);

  async function handleUnread(chunkId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const res = await fetch(`/api/chunks/${chunkId}/unread`, {
      method: "POST",
    });

    if (res.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${isPending ? "opacity-60" : ""}`}>
      {chunkIndices.map((idx, i) => {
        const chunkId = chunkIds[i];
        const isRead = idx < currentChunkIndex || readSet.has(chunkId);
        const isCurrent = idx === currentChunkIndex;

        return (
          <div key={chunkId} className="group relative">
            <Link
              href={`/read/${chunkId}`}
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
            {isRead && !isCurrent && (
              <button
                onClick={(e) => handleUnread(chunkId, e)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 group-hover:flex"
                title="Mark as unread"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

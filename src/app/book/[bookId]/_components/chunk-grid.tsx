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

  async function handleUnread(chunkId: string) {
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
          <ChunkTile
            key={chunkId}
            chunkId={chunkId}
            index={idx}
            isRead={isRead}
            isCurrent={isCurrent}
            onUnread={handleUnread}
          />
        );
      })}
    </div>
  );
}

interface ChunkTileProps {
  chunkId: string;
  index: number;
  isRead: boolean;
  isCurrent: boolean;
  onUnread: (chunkId: string) => void;
}

function ChunkTile({ chunkId, index, isRead, isCurrent, onUnread }: ChunkTileProps) {
  function handleUnreadClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onUnread(chunkId);
  }

  return (
    <div className="group relative">
      <Link
        href={`/read/${chunkId}`}
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-all duration-200 hover:scale-110 min-h-[44px] min-w-[44px] md:min-h-7 md:min-w-7 ${
          isCurrent
            ? "bg-emerald-500 text-white shadow-sm dark:bg-emerald-400 dark:text-background"
            : isRead
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10 hover:text-foreground/70"
        }`}
      >
        {index + 1}
      </Link>
      {isRead && !isCurrent && (
        <button
          onClick={handleUnreadClick}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm active:bg-red-700 md:hidden md:h-4 md:w-4 md:group-hover:flex md:hover:bg-red-600"
          title="Mark as unread"
        >
          <X className="h-3 w-3 md:h-2.5 md:w-2.5" />
        </button>
      )}
    </div>
  );
}

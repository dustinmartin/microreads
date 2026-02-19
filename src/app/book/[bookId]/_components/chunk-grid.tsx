"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Undo2 } from "lucide-react";
import { useTransition, useRef, useState, useCallback, useEffect } from "react";

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
  const [confirming, setConfirming] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Start long-press timer on touch
  function handleTouchStart() {
    if (!isRead || isCurrent) return;
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setConfirming(true);
      // Haptic feedback where supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      // Auto-cancel after 3 seconds
      confirmTimer.current = setTimeout(() => {
        setConfirming(false);
      }, 3000);
    }, 500);
  }

  // Cancel on scroll/move
  function handleTouchMove() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // Prevent navigation after long-press
  function handleTouchEnd(e: React.TouchEvent) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (didLongPress.current) {
      e.preventDefault();
      didLongPress.current = false;
    }
  }

  // Handle tap on confirmation state
  function handleConfirmTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    clearTimers();
    setConfirming(false);
    onUnread(chunkId);
  }

  // Desktop hover unread button click
  function handleDesktopUnread(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onUnread(chunkId);
  }

  if (confirming) {
    return (
      <button
        onClick={handleConfirmTap}
        onBlur={() => setConfirming(false)}
        className="inline-flex h-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-red-500 px-1.5 text-white shadow-sm transition-all duration-200 md:min-h-7 md:min-w-7 dark:bg-red-500"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="group relative">
      <Link
        href={`/read/${chunkId}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-all duration-200 hover:scale-110 min-h-[44px] min-w-[44px] md:min-h-7 md:min-w-7 ${
          isCurrent
            ? "bg-emerald-500 text-white shadow-sm dark:bg-emerald-400 dark:text-[#1A1A1A]"
            : isRead
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              : "bg-[#2C2C2C]/5 text-[#2C2C2C]/50 hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]/70 dark:bg-[#E8E4DC]/5 dark:text-[#E8E4DC]/40 dark:hover:bg-[#E8E4DC]/10"
        }`}
      >
        {index + 1}
      </Link>
      {isRead && !isCurrent && (
        <button
          onClick={handleDesktopUnread}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 group-hover:flex"
          title="Mark as unread"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

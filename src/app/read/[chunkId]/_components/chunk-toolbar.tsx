"use client";

import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { AudioPlayer } from "./audio-player";

type SummaryState = "idle" | "loading" | "showing" | "error";

interface ChunkToolbarProps {
  chunkId: string;
  showAudio: boolean;
  showSummary: boolean;
  autoplay: boolean;
  token?: string;
  cachedSummary?: string | null;
}

export function ChunkToolbar({
  chunkId,
  showAudio,
  showSummary,
  autoplay,
  token,
  cachedSummary,
}: ChunkToolbarProps) {
  const hasCached = !!cachedSummary;
  const [summaryState, setSummaryState] = useState<SummaryState>(hasCached ? "showing" : "idle");
  const [summary, setSummary] = useState(cachedSummary ?? "");
  const [chapterTitle, setChapterTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isBoxVisible, setIsBoxVisible] = useState(hasCached);

  async function handleSummaryClick() {
    if (summaryState === "showing") {
      setIsBoxVisible(!isBoxVisible);
      return;
    }

    setSummaryState("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/chunks/${chunkId}/summary`, {
        method: "POST",
      });

      if (res.status === 400) {
        setSummaryState("idle");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.detail || data.error || "Failed to generate summary",
        );
      }

      const data = await res.json();
      setSummary(data.summary);
      setChapterTitle(data.chapterTitle);
      setSummaryState("showing");
      setIsBoxVisible(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate summary",
      );
      setSummaryState("error");
    }
  }

  return (
    <div className="mx-auto mb-6" style={{ maxWidth: "65ch" }}>
      {/* Button row */}
      <div className="flex items-center gap-3">
        {showAudio && (
          <AudioPlayer chunkId={chunkId} autoplay={autoplay} token={token} />
        )}
        {showSummary && (
          <button
            onClick={handleSummaryClick}
            disabled={summaryState === "loading"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summaryState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            Summary
          </button>
        )}
      </div>

      {/* Error message */}
      {summaryState === "error" && errorMsg && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {errorMsg}. Tap Summary to retry.
        </p>
      )}

      {/* Summary box */}
      {summaryState === "showing" && isBoxVisible && (
        <div className="mt-4 rounded-lg bg-foreground/[0.04] px-5 py-4 dark:bg-foreground/[0.06]">
          <p className="mb-3 text-sm font-medium text-foreground/60 dark:text-foreground/50">
            Summary: {chapterTitle}
          </p>
          {summary.split("\n\n").map((paragraph, i) => (
            <p
              key={i}
              className="mb-3 text-base italic leading-relaxed text-foreground/70 last:mb-0 dark:text-foreground/60"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

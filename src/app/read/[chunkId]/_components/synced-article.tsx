"use client";

import { useRef, useEffect, memo, forwardRef } from "react";
import type { PlayerState } from "./audio-sync-reader";

interface TimingBlock {
  element: Element;
  startTime: number;
  endTime: number;
}

interface SyncedArticleProps {
  contentHtml: string;
  currentTime: number;
  duration: number;
  playerState: PlayerState;
}

interface ArticleContentProps {
  contentHtml: string;
}

// Memoized inner component — only re-renders when contentHtml changes.
// This keeps DOM nodes stable so timing map element references stay valid.
const ArticleContent = memo(
  forwardRef<HTMLElement, ArticleContentProps>(function ArticleContent(
    { contentHtml },
    ref
  ) {
    return (
      <article
        ref={ref}
        className="prose-reader mx-auto"
        style={{ maxWidth: "65ch" }}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  })
);

function buildTimingMap(
  container: HTMLElement,
  duration: number
): TimingBlock[] {
  const selector =
    ":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul > li, :scope > ol > li, :scope > blockquote";
  const elements = container.querySelectorAll(selector);
  const blocks: { element: Element; words: number }[] = [];
  let totalWords = 0;

  elements.forEach((el) => {
    const text = el.textContent || "";
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > 0) {
      blocks.push({ element: el, words });
      totalWords += words;
    }
  });

  if (totalWords === 0) return [];

  const timingBlocks: TimingBlock[] = [];
  let accumulated = 0;

  for (const block of blocks) {
    const blockDuration = (block.words / totalWords) * duration;
    timingBlocks.push({
      element: block.element,
      startTime: accumulated,
      endTime: accumulated + blockDuration,
    });
    accumulated += blockDuration;
  }

  return timingBlocks;
}

export function SyncedArticle({
  contentHtml,
  currentTime,
  duration,
  playerState,
}: SyncedArticleProps) {
  const articleRef = useRef<HTMLElement>(null);
  const timingMapRef = useRef<TimingBlock[]>([]);
  const activeElementRef = useRef<Element | null>(null);

  // Rebuild timing map when duration changes
  useEffect(() => {
    if (!articleRef.current || !duration || !isFinite(duration)) {
      timingMapRef.current = [];
      return;
    }
    timingMapRef.current = buildTimingMap(articleRef.current, duration);
  }, [duration]);

  // Clear highlights when audio is idle/loading/error
  useEffect(() => {
    if (
      playerState === "idle" ||
      playerState === "error" ||
      playerState === "loading"
    ) {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove("audio-highlight");
        activeElementRef.current = null;
      }
    }
  }, [playerState]);

  // Update highlight on currentTime change
  useEffect(() => {
    if (playerState !== "playing" && playerState !== "paused") return;

    const blocks = timingMapRef.current;
    if (blocks.length === 0) return;

    let activeBlock: TimingBlock | null = null;

    for (const block of blocks) {
      if (currentTime >= block.startTime && currentTime < block.endTime) {
        activeBlock = block;
        break;
      }
    }

    // Clamp to last block if past all blocks
    if (!activeBlock && currentTime >= blocks[blocks.length - 1].startTime) {
      activeBlock = blocks[blocks.length - 1];
    }

    if (!activeBlock) return;

    if (activeBlock.element !== activeElementRef.current) {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove("audio-highlight");
      }
      activeBlock.element.classList.add("audio-highlight");
      activeBlock.element.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      activeElementRef.current = activeBlock.element;
    }
  }, [currentTime, playerState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove("audio-highlight");
      }
    };
  }, []);

  return <ArticleContent ref={articleRef} contentHtml={contentHtml} />;
}

"use client";

import { useState, useRef, useCallback } from "react";
import { ChunkToolbar } from "./chunk-toolbar";
import { SyncedArticle } from "./synced-article";

export type PlayerState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export interface AudioState {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  duration: number;
  playerState: PlayerState;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlayerState: (state: PlayerState) => void;
}

interface AudioSyncReaderProps {
  chunkId: string;
  showAudio: boolean;
  showSummary: boolean;
  autoplay: boolean;
  token?: string;
  cachedSummary?: string | null;
  contentHtml: string;
}

export function AudioSyncReader({
  chunkId,
  showAudio,
  showSummary,
  autoplay,
  token,
  cachedSummary,
  contentHtml,
}: AudioSyncReaderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>(
    autoplay ? "loading" : "idle"
  );

  // Throttle currentTime updates to ~4Hz
  const lastUpdateRef = useRef(0);
  const setCurrentTime = useCallback((time: number) => {
    const now = performance.now();
    if (now - lastUpdateRef.current > 250) {
      lastUpdateRef.current = now;
      setCurrentTimeState(time);
    }
  }, []);

  // Force update for seeks (bypass throttle)
  const setCurrentTimeImmediate = useCallback((time: number) => {
    lastUpdateRef.current = performance.now();
    setCurrentTimeState(time);
  }, []);

  const audioState: AudioState = {
    audioRef,
    currentTime,
    duration,
    playerState,
    setCurrentTime,
    setDuration,
    setPlayerState,
  };

  return (
    <>
      {(showAudio || showSummary) && (
        <ChunkToolbar
          chunkId={chunkId}
          showAudio={showAudio}
          showSummary={showSummary}
          autoplay={autoplay}
          token={token}
          cachedSummary={cachedSummary}
          audioState={audioState}
          setCurrentTimeImmediate={setCurrentTimeImmediate}
        />
      )}

      <SyncedArticle
        contentHtml={contentHtml}
        currentTime={currentTime}
        duration={duration}
        playerState={playerState}
      />
    </>
  );
}

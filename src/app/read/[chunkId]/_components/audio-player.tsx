"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Headphones,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { AudioState } from "./audio-sync-reader";

interface AudioPlayerProps {
  chunkId: string;
  autoplay: boolean;
  token?: string;
  audioState: AudioState;
  setCurrentTimeImmediate: (time: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  chunkId,
  autoplay,
  token,
  audioState,
  setCurrentTimeImmediate,
}: AudioPlayerProps) {
  const {
    audioRef,
    currentTime,
    duration,
    playerState: state,
    setCurrentTime,
    setDuration,
    setPlayerState: setState,
  } = audioState;

  const [showControls, setShowControls] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const durationSetRef = useRef(false);

  const audioUrl = `/api/chunks/${chunkId}/audio${token ? `?token=${token}` : ""}`;

  const startPlayback = useCallback(() => {
    setState("loading");
    setErrorMsg(null);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationSetRef.current = true;
      }
    });

    audio.addEventListener("durationchange", () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationSetRef.current = true;
      }
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      // Fallback: pick up duration on timeupdate if not yet available
      if (!durationSetRef.current && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationSetRef.current = true;
      }
    });

    audio.addEventListener("canplay", async () => {
      try {
        await audio.play();
        setState("playing");
        setTimeout(() => setShowControls(true), 100);
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setState("ready");
        } else {
          setState("error");
          setErrorMsg("Failed to play audio");
        }
      }
    });

    audio.addEventListener("ended", () => {
      setState("paused");
    });

    audio.addEventListener("error", () => {
      setState("error");
      setErrorMsg("Failed to load audio");
    });

    audio.load();
  }, [audioUrl, audioRef, setState, setDuration, setCurrentTime]);

  useEffect(() => {
    if (autoplay) {
      startPlayback();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [autoplay, startPlayback, audioRef]);

  function handleListen() {
    if (state === "ready") {
      const audio = audioRef.current;
      if (audio) {
        audio.play();
        setState("playing");
        setTimeout(() => setShowControls(true), 100);
      }
    } else if (state === "idle" || state === "error") {
      startPlayback();
    }
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;

    if (state === "playing") {
      audio.pause();
      setState("paused");
    } else if (state === "paused") {
      audio.play();
      setState("playing");
    }
  }

  function handleRewind() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, audio.currentTime - 15);
    setCurrentTimeImmediate(audio.currentTime);

    if (state === "paused") {
      audio.play();
      setState("playing");
    }
  }

  function handleForward() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.min(
      audio.duration || Infinity,
      audio.currentTime + 15
    );
    setCurrentTimeImmediate(audio.currentTime);

    if (state === "paused") {
      audio.play();
      setState("playing");
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTimeImmediate(time);
  }

  // Idle / loading / ready / error states
  if (
    state === "idle" ||
    state === "loading" ||
    state === "ready" ||
    state === "error"
  ) {
    return (
      <div>
        <button
          onClick={handleListen}
          disabled={state === "loading"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "ready" ? (
            <Play className="h-4 w-4" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
          {state === "loading" ? "Generating audio..." : "Listen"}
        </button>
        {state === "error" && errorMsg && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errorMsg}. Tap to retry.
          </p>
        )}
      </div>
    );
  }

  // Playing / paused states — full player
  const hasDuration = isFinite(duration) && duration > 0;
  const progressPercent = hasDuration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex flex-col gap-2 transition-all duration-300 ease-out ${
        showControls
          ? "translate-y-0 opacity-100"
          : "-translate-y-2 opacity-0"
      }`}
    >
      {/* Controls row */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRewind}
          className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-2.5 text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Rewind 15 seconds"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={handlePlayPause}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {state === "playing" ? (
            <>
              <Pause className="h-4 w-4" /> Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Play
            </>
          )}
        </button>
        <button
          onClick={handleForward}
          className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-2.5 text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Forward 15 seconds"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        {hasDuration && (
          <span className="ml-2 text-xs tabular-nums text-foreground/60">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {hasDuration && (
        <div className="relative">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="audio-progress w-full"
            aria-label="Audio progress"
            style={
              {
                "--progress-percent": `${progressPercent}%`,
              } as React.CSSProperties
            }
          />
        </div>
      )}
    </div>
  );
}

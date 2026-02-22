"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Headphones, Loader2, Play, Pause, RotateCcw } from "lucide-react";

interface AudioPlayerProps {
  chunkId: string;
  autoplay: boolean;
  token?: string;
}

type PlayerState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export function AudioPlayer({ chunkId, autoplay, token }: AudioPlayerProps) {
  const [state, setState] = useState<PlayerState>(
    autoplay ? "loading" : "idle",
  );
  const [showControls, setShowControls] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = `/api/chunks/${chunkId}/audio${token ? `?token=${token}` : ""}`;

  const startPlayback = useCallback(() => {
    setState("loading");
    setErrorMsg(null);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

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
  }, [audioUrl]);

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
  }, [autoplay, startPlayback]);

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

    if (state === "paused") {
      audio.play();
      setState("playing");
    }
  }

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
          {state === "loading"
            ? "Generating audio..."
            : "Listen"}
        </button>
        {state === "error" && errorMsg && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errorMsg}. Tap to retry.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 transition-all duration-300 ease-out ${
        showControls
          ? "translate-y-0 opacity-100"
          : "-translate-y-2 opacity-0"
      }`}
    >
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
    </div>
  );
}

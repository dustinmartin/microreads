"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, CheckCircle2, RotateCcw, Trash2, Zap } from "lucide-react";

export default function BookControls({
  bookId,
  status,
}: {
  bookId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function restartBook() {
    setLoading(true);
    try {
      await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteBook() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  const buttonBase =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" && (
        <>
          <button
            onClick={() => updateStatus("paused")}
            disabled={loading}
            className={`${buttonBase} bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50`}
          >
            <Pause className="h-4 w-4" />
            Pause
          </button>
          <button
            onClick={() => updateStatus("completed")}
            disabled={loading}
            className={`${buttonBase} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/30 dark:text-slate-300 dark:hover:bg-slate-800/50`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark Complete
          </button>
        </>
      )}

      {status === "paused" && (
        <button
          onClick={() => updateStatus("active")}
          disabled={loading}
          className={`${buttonBase} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50`}
        >
          <Play className="h-4 w-4" />
          Resume
        </button>
      )}

      {status === "completed" && (
        <button
          onClick={restartBook}
          disabled={loading}
          className={`${buttonBase} bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50`}
        >
          <RotateCcw className="h-4 w-4" />
          Restart
        </button>
      )}

      {status === "queued" && (
        <button
          onClick={() => updateStatus("active")}
          disabled={loading}
          className={`${buttonBase} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50`}
        >
          <Zap className="h-4 w-4" />
          Activate
        </button>
      )}

      <button
        onClick={deleteBook}
        onBlur={() => setConfirmDelete(false)}
        disabled={loading}
        className={`${buttonBase} ${
          confirmDelete
            ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white"
            : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
        }`}
      >
        <Trash2 className="h-4 w-4" />
        {confirmDelete ? "Are you sure?" : "Delete Book"}
      </button>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, BookOpen, ArrowLeft, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type UploadResult = {
  id: string;
  title: string;
  author: string;
  totalChunks: number;
  status: string;
};

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(1000);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const estimatedChunks = Math.ceil(80000 / chunkSize);

  const handleFile = useCallback((selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith(".epub")) {
      setError("Only .epub files are accepted.");
      return;
    }
    setFile(selectedFile);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const handleSubmit = useCallback(
    async (status: "active" | "queued") => {
      if (!file) return;

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("epub", file);
        formData.append("chunkSize", String(chunkSize));
        formData.append("status", status);

        const response = await fetch("/api/books", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || `Upload failed (${response.status})`);
        }

        const data: UploadResult = await response.json();
        setResult(data);

        // Show result briefly, then redirect
        setTimeout(() => {
          router.push("/");
        }, 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setIsUploading(false);
      }
    },
    [file, chunkSize, router]
  );

  // Success state
  if (result) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1A1A1A]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              Book uploaded successfully!
            </h2>
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{result.title}</p>
              <p>{result.author}</p>
              <p>{result.totalChunks} chunks created</p>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Redirecting to library...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1A1A1A]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Upload Book
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add an epub to your reading library
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : file
                  ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20"
                  : "border-border hover:border-muted-foreground/40 hover:bg-accent/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              onChange={handleFileInput}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center">
                <FileText className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Click or drag to replace
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Drop your epub file here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to browse
                </p>
                <p className="mt-4 text-xs text-muted-foreground/70">
                  Only .epub files are accepted
                </p>
              </div>
            )}
          </div>

          {/* Chunk size slider */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <label
                htmlFor="chunk-size"
                className="text-sm font-medium text-foreground"
              >
                Chunk Size
              </label>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {chunkSize.toLocaleString()} words
              </span>
            </div>
            <input
              id="chunk-size"
              type="range"
              min={300}
              max={3000}
              step={50}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>300</span>
              <span>3,000</span>
            </div>

            {/* Estimated chunks preview */}
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Estimated{" "}
                <span className="font-semibold text-foreground">
                  ~{estimatedChunks} chunks
                </span>{" "}
                for an average-length book (~80k words)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => handleSubmit("active")}
              disabled={!file || isUploading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              Add to Active
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("queued")}
              disabled={!file || isUploading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Add to Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

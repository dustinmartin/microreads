"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function AiRecap({ recap }: { recap: string }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className="mx-auto mb-8 rounded-lg bg-foreground/[0.04] dark:bg-foreground/[0.06]"
      style={{ maxWidth: "60ch", fontFamily: "var(--font-serif), serif" }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-foreground/60 transition-colors hover:text-foreground/80 dark:text-foreground/50 dark:hover:text-foreground/70"
      >
        <span>Previously...</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-4">
          <p className="text-sm italic leading-relaxed text-foreground/70 dark:text-foreground/60">
            {recap}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function AiRecap({ recap }: { recap: string }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className="mx-auto mb-8 rounded-lg bg-[#2C2C2C]/[0.04] dark:bg-[#E8E4DC]/[0.06]"
      style={{ maxWidth: "60ch", fontFamily: "var(--font-serif), serif" }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-[#2C2C2C]/60 transition-colors hover:text-[#2C2C2C]/80 dark:text-[#E8E4DC]/50 dark:hover:text-[#E8E4DC]/70"
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
          <p className="text-sm italic leading-relaxed text-[#2C2C2C]/70 dark:text-[#E8E4DC]/60">
            {recap}
          </p>
        </div>
      )}
    </div>
  );
}

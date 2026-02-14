"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function CompletedSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-lg font-semibold text-foreground/80 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`h-5 w-5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        Completed
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

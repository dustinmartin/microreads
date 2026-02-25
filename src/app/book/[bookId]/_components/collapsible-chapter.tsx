"use client";

import { Collapsible } from "radix-ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface CollapsibleChapterProps {
  defaultOpen: boolean;
  header: ReactNode;
  children: ReactNode;
}

export default function CollapsibleChapter({
  defaultOpen,
  header,
  children,
}: CollapsibleChapterProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger asChild>
        <button className="flex w-full items-center gap-3 px-4 py-3 text-left">
          {header}
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-foreground/30 transition-transform duration-200 data-[state=open]:rotate-90 [[data-state=open]_&]:rotate-90" />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="border-t border-foreground/5 px-4 py-2">
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

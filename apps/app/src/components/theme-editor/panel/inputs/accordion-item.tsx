"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";

interface AccordionItemProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function AccordionItem({
  label,
  isOpen,
  onToggle,
  children,
}: AccordionItemProps) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
      >
        <span className="type-p text-foreground">{label}</span>
        <Icons.ChevronDown
          className={cn(
            "h-4 w-4 text-secondary transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

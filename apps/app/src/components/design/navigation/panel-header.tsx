"use client";

import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

interface PanelHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
}

export function PanelHeader({
  title,
  showBackButton = false,
  onBack,
  className,
}: PanelHeaderProps) {
  if (showBackButton && onBack) {
    return (
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "flex w-full px-4 py-3 border-b border-border justify-start items-center gap-2",
          "hover:bg-accent transition-colors duration-100 ease-out",
          "cursor-pointer",
          className
        )}
      >
        <Icons.ChevronLeft className="h-4 w-4 text-primary" />
        <p className="type-p !font-medium text-foreground">{title}</p>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full px-4 py-3 border-b border-border justify-start items-center",
        className
      )}
    >
      <p className="type-p !font-medium text-foreground">{title}</p>
    </div>
  );
}


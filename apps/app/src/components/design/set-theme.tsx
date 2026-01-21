"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";

interface SetThemeProps {
  updatedAt: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SetTheme({ updatedAt }: SetThemeProps) {
  return (
    <div className="border border-border bg-background flex flex-col overflow-hidden w-full">
      {/* Preview Block */}
      <div className="pt-4 px-8 pb-0 flex justify-center aspect-[10/4] relative overflow-hidden -mb-4 bg-[url('/assets/theme-background.webp')] bg-cover bg-center">
        <div className="flex items-center justify-center text-muted type-small">
          Preview will appear after saving theme
        </div>
      </div>

      {/* Info + Button Row */}
      <div className="pt-8 pb-4 px-4 flex flex-row border-t border-border justify-between items-center gap-3">
        {/* Left: Thumbnail + Text */}
        <div className="flex flex-row items-center gap-3">
          {/* Thumbnail */}
          <div className="w-[90px] h-[64px] border border-border overflow-hidden flex-shrink-0 bg-accent">
            <div className="w-full h-full flex items-center justify-center">
              <Icons.Palette className="w-6 h-6 text-muted" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1">
            <p className="type-p !font-medium text-foreground">Theme</p>
            <p className="type-small text-muted">
              Last edited on {formatDate(updatedAt)}
            </p>
          </div>
        </div>

        {/* Right: Button */}
        <Button asChild variant="outline">
          <Link href="/theme-editor" prefetch>
            <span className="px-1">Edit theme</span>
            <Icons.ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

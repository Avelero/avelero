"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { useEffect, useState } from "react";

export function SaveBar() {
  const { hasUnsavedChanges, isSaving, resetDrafts, saveDrafts } =
    useDesignEditor();

  const shouldShow = hasUnsavedChanges || isSaving;
  const [isVisible, setIsVisible] = useState(false);

  // Animate in when shouldShow becomes true
  useEffect(() => {
    if (shouldShow) {
      // Trigger animation on next frame after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      // Reset visibility for next time
      setIsVisible(false);
    }
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex absolute bottom-6 items-center justify-between rounded-full border bg-background pl-4 pr-2 py-2 max-w-[440px] w-full z-20",
        "shadow-[0_6px_18px_rgba(0,0,0,0.02),0_3px_9px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04)]",
        "transition-[transform,opacity] duration-[250ms] ease-out origin-bottom",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[0.9]",
      )}
    >
      <div className="flex items-center gap-2">
        <Icons.Info className="h-3.5 w-3.5 text-secondary" />
        <div className="type-p text-secondary">You have unsaved changes</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={resetDrafts}
          disabled={isSaving}
          className="rounded-full"
        >
          Cancel
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={saveDrafts}
          disabled={isSaving}
          className="rounded-full"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

export function SaveBar() {
  const { hasUnsavedChanges, isSaving, resetDrafts, saveDrafts } =
    useDesignEditor();

  if (!hasUnsavedChanges && !isSaving) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-full border bg-background pl-4 pr-2 py-2 w-[440px] shadow-sm">
      <div className="flex items-center gap-2">
        <Icons.Info className="h-3.5 w-3.5 text-secondary" />
        <div className="type-p text-secondary">
          You have unsaved changes
        </div>
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
        <Button variant="brand" size="sm" onClick={saveDrafts} disabled={isSaving} className="rounded-full">
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

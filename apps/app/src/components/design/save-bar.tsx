'use client';

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";

export function SaveBar() {
  const { hasUnsavedChanges, isSaving, resetDrafts, saveDrafts } =
    useDesignEditor();

  if (!hasUnsavedChanges && !isSaving) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-4">
      <div className="flex items-center gap-3 rounded-full border bg-white px-4 py-2 shadow-md">
        <div className="text-sm text-muted-foreground">
          You have unsaved changes
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetDrafts}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={saveDrafts} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

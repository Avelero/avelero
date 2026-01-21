"use client";

/**
 * Unsaved Changes Modal
 *
 * Reusable confirmation dialog shown when user attempts to navigate
 * away from a form with unsaved changes. Used by both product and
 * variant forms.
 */

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";

interface UnsavedChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
}

/**
 * Modal for confirming navigation away from unsaved form changes.
 * Styled consistently with other application modals.
 */
export function UnsavedChangesModal({
  open,
  onOpenChange,
  onDiscard,
  onKeepEditing,
  title = "Discard changes?",
  description = "You have unsaved changes. If you leave now, your edits will be lost.",
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[40px]">
          <DialogDescription className="text-secondary">
            {description}
          </DialogDescription>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              onKeepEditing();
              onOpenChange(false);
            }}
          >
            Keep editing
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => {
              onDiscard();
              onOpenChange(false);
            }}
          >
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-secondary w-full whitespace-normal break-words">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
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

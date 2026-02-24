"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  hideConfirm = false,
  onConfirm,
  isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideConfirm?: boolean;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          <DialogDescription className="text-secondary">
            {description}
          </DialogDescription>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          {!hideConfirm ? (
            <Button
              variant="destructive"
              type="button"
              onClick={() => void onConfirm()}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : confirmLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

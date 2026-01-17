"use client";

/**
 * First Publish Modal
 *
 * Warning modal shown when publishing a passport for the first time.
 * Informs users that attribute matrix will be locked after publishing.
 * Includes "Don't show again" checkbox with localStorage persistence.
 */

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import * as React from "react";

const STORAGE_KEY = "avelero_first_publish_modal_dismissed";
const EXPIRY_DAYS = 60;

interface FirstPublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPublishing?: boolean;
}

/**
 * Check if the "don't show again" preference has been set and is still valid
 */
export function shouldShowFirstPublishModal(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true;

    const { expiresAt } = JSON.parse(stored);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Set the "don't show again" preference with expiry
 */
function setDismissPreference(): void {
  if (typeof window === "undefined") return;

  const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt }));
}

/**
 * Modal for warning users about attribute locking on first publish.
 * Once published, users cannot add or remove attributes from the product.
 */
export function FirstPublishModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isPublishing = false,
}: FirstPublishModalProps) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const handleConfirm = () => {
    if (dontShowAgain) {
      setDismissPreference();
    }
    onConfirm();
  };

  const handleCancel = () => {
    setDontShowAgain(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Publishing your passport
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <p className="type-p text-secondary">
            Once published, you will no longer be able to add or remove
            attributes from this product. You can still edit individual variants
            and their attribute values.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <div
              className="relative inline-flex h-4 w-4 items-center justify-center mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
              />
              {dontShowAgain && (
                <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <div className="w-[10px] h-[10px] bg-brand" />
                </div>
              )}
            </div>
            <span className="type-small text-secondary">
              Do not show this again
            </span>
          </label>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={handleCancel}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            type="button"
            onClick={handleConfirm}
            disabled={isPublishing}
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Variant Deletion Warning Modal
 *
 * Shown when user attempts to delete variants that have active passports.
 * Warns that the passport pages will become orphaned (but still resolvable via QR code).
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
import { Icons } from "@v1/ui/icons";

export interface VariantToDelete {
  /** Variant's unique product identifier (used as key) */
  upid: string;
  /** Human-readable attribute summary (e.g., "Black / 2XS") */
  attributeSummary: string;
  /** Optional SKU */
  sku?: string | null;
  /** Optional Barcode */
  barcode?: string | null;
}

interface VariantDeletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** List of variants that will be deleted */
  variants: VariantToDelete[];
  /** Callback when user confirms deletion */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Modal warning users about variant deletion and passport orphaning.
 *
 * When variants are deleted, their associated passports become "orphaned" -
 * they remain resolvable via QR code but no longer link to an active variant.
 */
export function VariantDeletionModal({
  open,
  onOpenChange,
  variants,
  onConfirm,
  onCancel,
}: VariantDeletionModalProps) {
  const count = variants.length;
  const isSingle = count === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>
            {isSingle ? "Remove variant?" : `Remove ${count} variants?`}
          </DialogTitle>
          <DialogDescription className="text-secondary">
            {isSingle
              ? "This variant has an active passport. Removing it will orphan the passport page."
              : `These ${count} variants have active passports. Removing them will orphan their passport pages.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Variant table */}
          <div className="border border-border max-h-[200px] overflow-y-auto">
            {/* Header */}
            <div className="grid grid-cols-3 bg-accent-light border-b border-border sticky top-0">
              <div className="px-3 py-2">
                <span className="type-xsmall text-secondary font-medium">
                  Variant
                </span>
              </div>
              <div className="px-3 py-2">
                <span className="type-xsmall text-secondary font-medium">
                  SKU
                </span>
              </div>
              <div className="px-3 py-2">
                <span className="type-xsmall text-secondary font-medium">
                  Barcode
                </span>
              </div>
            </div>
            {/* Rows */}
            {variants.map((variant, index) => (
              <div
                key={variant.upid}
                className="grid grid-cols-3 border-b border-border last:border-b-0"
              >
                <div className="px-3 py-2">
                  <span className="type-small text-foreground">
                    {variant.attributeSummary || `Variant ${index + 1}`}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <span className="type-small text-foreground">
                    {variant.sku || "—"}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <span className="type-small text-foreground">
                    {variant.barcode || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Warning notice */}
          <div className="flex gap-3 p-3 border border-warning bg-warning/10">
            <Icons.AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="type-small text-secondary">
              Orphaned passports will still be accessible via their QR codes,
              but will show limited information.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {isSingle ? "Remove variant" : `Remove ${count} variants`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

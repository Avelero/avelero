"use client";

import { useEffect, useMemo, useState } from "react";
import { useCanLeaveBrandQuery, useLeaveBrandMutation } from "@/hooks/use-brand";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@v1/ui/dialog";
import { Button } from "@v1/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  brandName: string;
  role: "owner" | "member" | null;
  onLeft?: (nextBrandId: string | null) => void;
}

export function LeaveBrandModal({ open, onOpenChange, brandId, brandName, role, onLeft }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Always read cached canLeave data so closing animation doesn't flip state
  const { data: canLeaveData } = useCanLeaveBrandQuery(brandId);
  const leaveMutation = useLeaveBrandMutation();

  const isSoleOwnerBlocked = useMemo(() => {
    const res = canLeaveData as any;
    if (!res) return false;
    if (res.canLeave === false && res.reason === "SOLE_OWNER") return true;
    return false;
  }, [canLeaveData]);

  const title = isSoleOwnerBlocked
    ? "Cannot leave brand"
    : "Leave brand";

  const descriptionNode = isSoleOwnerBlocked ? (
    <>
      You are the sole owner of <span className="text-p !font-medium text-foreground">{brandName}</span>. Promote another member to owner or delete the brand to proceed.
    </>
  ) : (
    <>
      You are about to leave <span className="text-p !font-medium text-foreground">{brandName}</span>. You will lose access until re-invited.
    </>
  );

  function onConfirmLeave() {
    if (!brandId || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    (leaveMutation as any).mutate(
      { id: brandId },
      {
        onError: (e: any) => {
          const message = e?.message || "Unable to leave brand";
          setError(message);
          setIsSubmitting(false);
        },
        onSuccess: (res: any) => {
          setIsSubmitting(false);
          onLeft?.(res?.nextBrandId ?? null);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-secondary w-full whitespace-normal break-words">
            {descriptionNode}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="w-full flex gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          >
            Cancel
          </Button>
          {isSoleOwnerBlocked ? null : (
            <Button
              type="button"
              variant="default"
              onClick={onConfirmLeave}
              disabled={isSubmitting}
              className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              {isSubmitting ? "Leaving..." : "Leave"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



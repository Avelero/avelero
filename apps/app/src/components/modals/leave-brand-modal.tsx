"use client";

import { useLeaveBrandMutation, useWorkflowBrandById } from "@/hooks/use-brand";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { toast } from "@v1/ui/sonner";
import { useEffect, useMemo, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  brandName: string;
  role: "owner" | "member" | null;
  onLeft?: (nextBrandId: string | null) => void;
}

export function LeaveBrandModal({
  open,
  onOpenChange,
  brandId,
  brandName,
  role,
  onLeft,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Always read cached canLeave data so closing animation doesn't flip state
  const membership = useWorkflowBrandById(brandId);
  const leaveMutation = useLeaveBrandMutation();

  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type LeaveBrandResult = RouterOutputs["user"]["brands"]["leave"];

  const membershipRole = membership?.role ?? role;
  const canLeave =
    membership?.canLeave ??
    (membershipRole !== null && membershipRole !== "owner");
  const isSoleOwnerBlocked = useMemo(
    () => membershipRole === "owner" && canLeave === false,
    [membershipRole, canLeave],
  );

  const title = isSoleOwnerBlocked ? "Cannot leave brand" : "Leave brand";

  const descriptionNode = isSoleOwnerBlocked ? (
    <>
      You are the sole owner of{" "}
      <span className="type-p !font-medium text-foreground">{brandName}</span>.
      Promote another member to owner or delete the brand to proceed.
    </>
  ) : (
    <>
      You are about to leave{" "}
      <span className="type-p !font-medium text-foreground">{brandName}</span>.
      You will lose access until re-invited.
    </>
  );

  function onConfirmLeave() {
    if (!brandId || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    leaveMutation.mutate(
      { brand_id: brandId },
      {
        onError: (e) => {
          const message =
            e instanceof Error ? e.message : "Unable to leave brand";
          setError(message);
          setIsSubmitting(false);
          toast.error("Action failed, please try again");
        },
        onSuccess: (res: LeaveBrandResult) => {
          setIsSubmitting(false);
          toast.success(`Left ${brandName}`);
          onLeft?.(res.nextBrandId ?? null);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 min-h-[40px]">
          <DialogDescription className="text-secondary">
            {descriptionNode}
          </DialogDescription>
          {error ? (
            <p className="type-small text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {isSoleOwnerBlocked ? null : (
            <Button
              type="button"
              variant="default"
              onClick={onConfirmLeave}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Leaving..." : "Leave"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

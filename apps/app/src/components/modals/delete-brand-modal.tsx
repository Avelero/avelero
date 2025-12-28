"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
}

function DeleteBrandModal({ open, onOpenChange, brandId }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trpc = useTRPC();
  const router = useRouter();
  const deleteMutation = useMutation(trpc.brand.delete.mutationOptions());

  // Prefetch possible navigation routes for post-deletion
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/create-brand");
  }, [router]);

  async function onConfirm() {
    if (confirmText !== "DELETE" || deleteMutation.isPending) return;
    setError(null);

    try {
      // Delete brand via API (soft-delete + triggers background job)
      const result = await deleteMutation.mutateAsync({ brand_id: brandId });

      // Close modal before redirect
      onOpenChange(false);

      // Smart redirection based on remaining brands
      const payload = result as { nextBrandId?: string | null };
      const destination = payload.nextBrandId ? "/" : "/create-brand";

      // Force fresh server data after brand deletion
      router.refresh();
      router.push(destination);
    } catch (e: unknown) {
      const error =
        e instanceof Error ? e : new Error("Failed to delete brand");
      setError(error.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete brand</DialogTitle>
          <DialogDescription className="text-secondary w-full whitespace-normal break-words">
            This action is irreversible. All brand data including members and
            invites will be permanently deleted. Type DELETE to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full flex flex-col gap-3">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="w-full"
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="w-full flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleteMutation.isPending}
              className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={confirmText !== "DELETE" || deleteMutation.isPending}
              className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteBrandModal };

"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteAccountModal({ open, onOpenChange }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trpc = useTRPC();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const deleteMutation = useMutation(trpc.user.delete.mutationOptions());

  // Prefetch login route for post-deletion navigation
  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  async function onConfirm() {
    if (confirmText !== "DELETE" || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Delete account via API
      await deleteMutation.mutateAsync();

      // Step 2: Sign out locally (this will clear session)
      await supabase.auth.signOut({ scope: "local" });

      // Step 3: Redirect to login (query cache will be invalidated on navigation)
      router.push("/login");
    } catch (e: unknown) {
      const error =
        e instanceof Error ? e : new Error("Failed to delete account");
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Delete account</DialogTitle>
          <DialogDescription className="text-secondary">
            This action is irreversible. Type DELETE to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="w-full"
          />
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
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={confirmText !== "DELETE" || isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteAccountModal };

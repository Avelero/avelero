"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@v1/ui/dialog";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useTRPC } from "@/trpc/client";
import { createClient } from "@v1/supabase/client";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  async function onConfirm() {
    if (confirmText !== "DELETE" || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { mutationFn } = trpc.user.delete.mutationOptions() as any;
      await mutationFn();
      await supabase.auth.signOut({ scope: "local" });
      router.push("/login");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This action is irreversible. Type DELETE to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={confirmText !== "DELETE" || isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteAccountModal };



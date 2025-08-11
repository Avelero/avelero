"use client";

import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@v1/ui/dialog";
import { useState } from "react";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const trpc = useTRPC();

  const deleteMutation = useMutation(
    trpc.user.delete.mutationOptions({
      onSuccess: () => {
        window.location.assign(`/${locale}/login`);
      },
    }),
  );

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}




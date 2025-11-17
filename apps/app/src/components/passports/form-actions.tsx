"use client";

import * as React from "react";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { useRouter } from "next/navigation";

export function PassportFormActions() {
  const router = useRouter();
  const { isSubmitting, hasUnsavedChanges } = usePassportFormContext();
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleCancel = () => {
    if (hasUnsavedChanges && !isSubmitting) {
      setShowConfirm(true);
      return;
    }
    router.push("/passports");
  };

  return (
    <>
      <Button
        variant="outline"
        type="button"
        onClick={handleCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        variant="brand"
        type="submit"
        form="passport-form"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. If you leave now, your edits will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowConfirm(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                setShowConfirm(false);
                router.push("/passports");
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

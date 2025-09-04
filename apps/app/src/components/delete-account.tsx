"use client";

import { DeleteAccountModal } from "@/components/modals/delete-account-modal";
import { Button } from "@v1/ui/button";
import { useState } from "react";

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-row p-6 border border-destructive justify-between items-center">
      <div className="flex flex-col gap-2">
        <h6 className="text-foreground">Delete Account</h6>
        <p className="text-secondary">Permanently delete your account.</p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Account
      </Button>
      <DeleteAccountModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

export { DeleteAccount };

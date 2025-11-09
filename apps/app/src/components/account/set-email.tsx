"use client";

import { EmailChangeModal } from "@/components/modals/email-change-modal";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useEffect, useState } from "react";
import { z } from "zod";

const emailSchema = z.string().email();

function SetEmail() {
  const { data } = useUserQuery();
  const currentEmail = (data as CurrentUser | null | undefined)?.email ?? "";

  const [email, setEmail] = useState(currentEmail);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEmail(currentEmail);
  }, [currentEmail]);

  const isValidEmail = emailSchema.safeParse(email).success;
  const canSave = isValidEmail && email !== currentEmail;

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Email</h6>
          <p className="text-secondary">
            Enter your email address on the right.
          </p>
        </div>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={open}
          className="max-w-[250px] disabled:opacity-100 disabled:cursor-text"
        />
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={!canSave}
          onClick={() => setOpen(true)}
        >
          Save
        </Button>
      </div>

      <EmailChangeModal
        open={open}
        onOpenChange={setOpen}
        currentEmail={currentEmail}
        newEmail={email}
      />
    </div>
  );
}

export { SetEmail };

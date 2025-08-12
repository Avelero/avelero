"use client";

import { useState } from "react";
import { z } from "zod";
import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@v1/ui/command";

interface Invitee {
  email: string;
  role: "owner" | "member";
}

const emailSchema = z.string().email();

function RoleSelector({ value, onChange }: { value: Invitee["role"]; onChange: (r: Invitee["role"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">{value === "owner" ? "Owner" : "Member"}</Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-40">
        <Command>
          <CommandList>
            <CommandEmpty>No roles</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange("member"); setOpen(false); }}>
                Member
              </CommandItem>
              <CommandItem onSelect={() => { onChange("owner"); setOpen(false); }}>
                Owner
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InviteModal({ brandId }: { brandId: string }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([{ email: "", role: "member" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateInvitee(index: number, patch: Partial<Invitee>) {
    setInvitees((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addInvitee() {
    setInvitees((prev) => [...prev, { email: "", role: "member" }]);
  }

  function removeInvitee(index: number) {
    setInvitees((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSend() {
    setIsSubmitting(true);
    setError(null);
    try {
      for (const inv of invitees) {
        const parsed = emailSchema.safeParse(inv.email);
        if (!parsed.success) throw new Error(`Invalid email: ${inv.email}`);
        // use mutationOptions to align with project conventions
        const mutation = trpc.brand.sendInvite.mutationOptions();
        await (mutation.mutationFn as any)({ brand_id: brandId, email: inv.email, role: inv.role });
      }
      setOpen(false);
      setInvitees([{ email: "", role: "member" }]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send invites";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Invite members</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {invitees.map((inv, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={inv.email}
                onChange={(e) => updateInvitee(i, { email: e.target.value })}
              />
              <RoleSelector value={inv.role} onChange={(role) => updateInvitee(i, { role })} />
              {invitees.length > 1 ? (
                <Button variant="outline" size="icon" onClick={() => removeInvitee(i)}>
                  −
                </Button>
              ) : null}
            </div>
          ))}
          <div>
            <Button variant="ghost" size="sm" onClick={addInvitee}>+ Add another</Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="pt-2">
            <Button onClick={onSend} disabled={isSubmitting}>Send invite{invitees.length > 1 ? "s" : ""}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import { useState } from "react";
import { z } from "zod";

interface Invitee {
  id: string;
  email: string;
  role: "owner" | "member";
}

const emailSchema = z.string().email();

function RoleSelector({
  value,
  onChange,
}: { value: Invitee["role"]; onChange: (r: Invitee["role"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="h-[39px] w-[110px] justify-between items-center flex-shrink-0"
          variant="outline"
        >
          {value === "owner" ? "Owner" : "Member"}
          <Icons.ChevronDown className="h-4 w-4" strokeWidth={1} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-40 rounded-none" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No roles</CommandEmpty>
            <CommandGroup>
              {["member", "owner"].map((role) => (
                <CommandItem
                  key={role}
                  onSelect={() => {
                    onChange(role as Invitee["role"]);
                    setOpen(false);
                  }}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InviteModal({ brandId }: { brandId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([
    {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      email: "",
      role: "member",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendInvite = useMutation(
    trpc.workflow.invites.send.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.invites.list.queryKey({
              brand_id: brandId,
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({
              brand_id: brandId,
            }),
          }),
        ]);
      },
    }),
  );

  async function onSend() {
    setIsSubmitting(true);
    setError(null);
    try {
      for (const inv of invitees) {
        const parsed = emailSchema.safeParse(inv.email);
        if (!parsed.success) throw new Error(`Invalid email: ${inv.email}`);
        await sendInvite.mutateAsync({
          brand_id: brandId,
          email: inv.email,
          role: inv.role,
        });
        toast.success(`Invite sent to ${inv.email}`);
      }
      setOpen(false);
      setInvitees([
        {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          email: "",
          role: "member",
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send invites");
      toast.error("Action failed, please try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Invite members</Button>
      </DialogTrigger>
      <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none w-[468px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite members</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            {invitees.map((inv, i) => (
              <div key={inv.id} className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={inv.email}
                  onChange={(e) =>
                    setInvitees((prev) =>
                      prev.map((it, j) =>
                        j === i ? { ...it, email: e.target.value } : it,
                      ),
                    )
                  }
                  className="w-full"
                />
                <RoleSelector
                  value={inv.role}
                  onChange={(role) =>
                    setInvitees((prev) =>
                      prev.map((it, j) => (j === i ? { ...it, role } : it)),
                    )
                  }
                />
                {invitees.length > 1 && (
                  <Button
                    className="w-[39px] h-[39px] flex-shrink-0"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setInvitees((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Icons.X className="h-4 w-4" strokeWidth={1} />
                  </Button>
                )}
              </div>
            ))}
            {invitees.length < 5 && (
              <div>
                <Button
                  className="text-secondary"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setInvitees((prev) => [
                      ...prev,
                      {
                        id:
                          crypto.randomUUID?.() ??
                          `${Date.now()}-${Math.random()}`,
                        email: "",
                        role: "member",
                      },
                    ])
                  }
                >
                  + Add another
                </Button>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="w-full flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={onSend}
              disabled={isSubmitting}
              className="w-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              {isSubmitting
                ? "Sending..."
                : `Send invite${invitees.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

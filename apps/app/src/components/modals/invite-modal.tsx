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
  DialogFooter,
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
          className="h-9 w-[110px] justify-between items-center flex-shrink-0 data-[state=open]:bg-accent"
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
    trpc.brand.invites.send.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.brand.invites.list.queryKey({}),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({}),
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
      <DialogContent className="max-w-[520px] p-0 gap-0 border border-border overflow-visible">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Invite members</DialogTitle>
        </DialogHeader>

        {/* Main content */}
        <div className="px-6 py-4 min-h-[160px] space-y-4">
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
                    className="w-9 h-9 flex-shrink-0"
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
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Sending..."
              : `Send invite${invitees.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

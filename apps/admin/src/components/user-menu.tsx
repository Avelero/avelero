"use client";

import { SignOut } from "@/components/auth/sign-out";
import { SignedAvatar } from "@/components/signed-avatar";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";

export function UserMenu() {
  const trpc = useTRPC();
  const { data: viewer } = useSuspenseQuery(
    trpc.platformAdmin.viewer.get.queryOptions(),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
        >
          <SignedAvatar
            url={viewer?.avatar_url ?? null}
            name={viewer?.full_name ?? viewer?.email ?? undefined}
            size={32}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" sideOffset={10} align="end">
        <DropdownMenuLabel>
          <span className="truncate line-clamp-1 max-w-[155px] text-foreground font-medium block">
            {viewer?.full_name ?? "Platform Admin"}
          </span>
          <span className="truncate type-small text-secondary">
            {viewer?.email ?? ""}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <SignOut />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

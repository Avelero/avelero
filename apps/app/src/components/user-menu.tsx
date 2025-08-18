"use client";

import { useUserQuery, useUserQuerySuspense, CurrentUser } from "@/hooks/use-user";
import { SmartAvatar } from "@v1/ui/avatar";
import { SignedAvatar } from "./signed-avatar";
import { Icons } from "@v1/ui/icons";
import { Suspense } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import Link from "next/link";
import { SignOut } from "@/components/auth/sign-out";

type Props = {
  onlySignOut?: boolean;
};

function UserAvatar() {
  const { data } = useUserQuerySuspense();
  const user = data as CurrentUser | null;
  return (
    <SignedAvatar
      bucket="avatars"
      path={user?.avatar_path ?? null}
      name={user?.full_name ?? undefined}
      hue={user?.avatar_hue ?? undefined}
      size={32}
    />
  );
}

export function UserMenu({ onlySignOut }: Props) {
  const { data: user } = useUserQuery();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
          <Suspense fallback={<SmartAvatar size={32} loading />}> 
            <UserAvatar />
          </Suspense>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" sideOffset={10} align="end">
        {!onlySignOut && (
          <>
            <DropdownMenuLabel>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="truncate line-clamp-1 max-w-[155px] text-foreground font-medium block">
                    {(user as CurrentUser | null | undefined)?.full_name ?? ""}
                  </span>
                  <span className="truncate text-s text-secondary">
                    {(user as CurrentUser | null | undefined)?.email ?? ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <Link prefetch href="/account">
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </>
        )}

        <SignOut />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
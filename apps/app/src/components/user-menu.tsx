"use client";

import { useUserQuery, useUserQuerySuspense, CurrentUser } from "@/hooks/use-user";
import { Avatar } from "@v1/ui/avatar";
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
    <Avatar 
      className="rounded-full w-8 h-8 cursor-pointer"
      src={user?.avatar_url ?? undefined}
      name={user?.full_name ?? undefined}
      hue={user?.avatar_hue ?? undefined}
      width={32}
      height={32}
    />
  );
}

export function UserMenu({ onlySignOut }: Props) {
  const { data: user } = useUserQuery();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
          <Suspense fallback={
            <Avatar className="rounded-full w-8 h-8 cursor-pointer">
              <div className="flex h-full w-full items-center justify-center bg-accent">
                <Icons.UserRound className="text-tertiary" />
              </div>
            </Avatar>
          }>
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
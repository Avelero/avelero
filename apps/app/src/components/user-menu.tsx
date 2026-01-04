"use client";

import { SignOut } from "@/components/auth/sign-out";
import { type CurrentUser, useUserQuerySuspense } from "@/hooks/use-user";
import { SmartAvatar } from "@v1/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";
import { Suspense } from "react";
import { SignedAvatar } from "./signed-avatar";

type Props = {
  onlySignOut?: boolean;
};

function UserMenuContent({ onlySignOut }: Props) {
  const { data } = useUserQuerySuspense();
  const user = data as CurrentUser | null | undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
        >
          <SignedAvatar
            bucket="avatars"
            id={user?.id ?? ""}
            url={user?.avatar_url ?? null}
            name={user?.full_name ?? undefined}
            size={32}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" sideOffset={10} align="end">
        {!onlySignOut && (
          <>
            <DropdownMenuLabel>
              <span className="truncate line-clamp-1 max-w-[155px] text-foreground font-medium block">
                {user?.full_name ?? ""}
              </span>
              <span className="truncate type-small text-secondary">
                {user?.email ?? ""}
              </span>
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

function UserMenuSkeleton() {
  return (
    <div className="rounded-full">
      <SmartAvatar size={32} loading />
    </div>
  );
}

export function UserMenu(props: Props) {
  return (
    <Suspense fallback={<UserMenuSkeleton />}>
      <UserMenuContent {...props} />
    </Suspense>
  );
}

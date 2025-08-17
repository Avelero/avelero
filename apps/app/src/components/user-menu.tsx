"use client";

import { useUserQuery } from "@/hooks/use-user";
import { Avatar, AvatarFallback, AvatarImageNext } from "@v1/ui/avatar";
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

export function UserMenu({ onlySignOut }: Props) {
  const { data: user, isLoading } = useUserQuery();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="rounded-full w-8 h-8 cursor-pointer">
          {!isLoading && user?.avatar_url && (
            <AvatarImageNext
              src={user?.avatar_url}
              alt={user?.full_name ?? ""}
              width={32}
              height={32}
              quality={100}
            />
          )}
          <AvatarFallback>
            {isLoading ? (
              <div className="w-4 h-4 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            ) : (
              <span className="text-xs">
                {user?.full_name?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" sideOffset={10} align="end">
        {!onlySignOut && (
          <>
            <DropdownMenuLabel>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="truncate line-clamp-1 max-w-[155px] text-foreground font-medium block">
                    {user?.full_name}
                  </span>
                  <span className="truncate text-s text-secondary">
                    {user?.email}
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
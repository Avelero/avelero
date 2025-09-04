"use client";

import { SignedAvatar } from "@/components/signed-avatar";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { useMemo } from "react";

interface MemberRow {
  id: string;
  role: "owner" | "member" | null;
  user: {
    id: string | null;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    avatarHue?: number | null;
  } | null;
  created_at?: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: "owner" | "member";
  expires_at: string | null;
  created_at: string | null;
}

type Props =
  | { membership: MemberRow; currentUserId: string | null; locale: string }
  | { invite: InviteRow; locale: string };

export function MembersRow(props: Props) {
  if ("membership" in props)
    return (
      <MembershipRow
        membership={props.membership}
        currentUserId={props.currentUserId}
        locale={props.locale}
      />
    );
  return <InviteRowComp invite={props.invite} locale={props.locale} />;
}

function MembershipRow({
  membership,
  currentUserId,
  locale,
}: { membership: MemberRow; currentUserId: string | null; locale: string }) {
  const email = membership.user?.email ?? "";
  const role = membership.role === "owner" ? "Owner" : "Member";
  const isSelf = currentUserId && membership.user?.id === currentUserId;

  const joinedDate = membership.created_at
    ? new Date(membership.created_at)
    : null;
  const joinedText = joinedDate
    ? `Joined ${joinedDate.toLocaleDateString(locale || "en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}`
    : "Joined";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar
          bucket="avatars"
          path={membership.user?.avatarUrl ?? null}
          hue={membership.user?.avatarHue ?? undefined}
          size={32}
          name={
            membership.user?.fullName ?? membership.user?.email ?? undefined
          }
        />
        <div className="flex flex-col">
          <span className="text-p !font-medium">{email}</span>
          <span className="text-p text-secondary">{role}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-p text-secondary">{joinedText}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Member options">
              <Icons.EllipsisVertical className="w-4 h-4" strokeWidth={1} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assign role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem disabled={membership.role === "owner"}>
                  Owner
                </DropdownMenuItem>
                <DropdownMenuItem disabled={membership.role === "member"}>
                  Member
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              disabled={!!isSelf}
              className={isSelf ? undefined : "text-destructive"}
            >
              Remove member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function InviteRowComp({
  invite,
  locale,
}: { invite: InviteRow; locale: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const revokeInviteMutation = useMutation(
    trpc.brand.revokeInvite.mutationOptions(),
  );

  const expiresInDays = useMemo(() => {
    if (!invite.expires_at) return null;
    const now = new Date();
    const exp = new Date(invite.expires_at);
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days;
  }, [invite.expires_at]);

  async function onWithdraw() {
    await revokeInviteMutation.mutateAsync({ invite_id: invite.id });
    await queryClient.invalidateQueries({
      queryKey: trpc.brand.listInvites.queryKey(),
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-p !font-medium">{invite.email}</span>
        <span className="text-p text-secondary">
          {invite.role === "owner" ? "Owner" : "Member"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-p text-secondary">
          {invite.created_at
            ? `Sent on ${new Date(invite.created_at).toLocaleDateString(locale || "en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}`
            : "Sent"}
          {typeof expiresInDays === "number"
            ? `, expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`
            : ""}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Invite options">
              <Icons.EllipsisVertical className="w-4 h-4" strokeWidth={1} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onWithdraw} className="text-destructive">
              Withdraw invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

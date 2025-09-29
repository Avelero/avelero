"use client";

import { SignedAvatar } from "@/components/signed-avatar";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
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
import { toast } from "@v1/ui/sonner";
import { useMemo } from "react";

interface MemberRow {
  id: string;
  role: "owner" | "member" | null;
  user: {
    id: string | null;
    email: string | null;
    fullName: string | null;
    avatarPath: string | null;
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

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Members = RouterOutputs["brand"]["members"];
type ListInvites = RouterOutputs["brand"]["listInvites"];

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const email = membership.user?.email ?? "";
  const role = membership.role === "owner" ? "Owner" : "Member";
  const isSelf = currentUserId && membership.user?.id === currentUserId;
  const updateMemberMutation = useMutation(
    trpc.brand.updateMember.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.brand.members.queryKey(),
        });
        const previous = queryClient.getQueryData(
          trpc.brand.members.queryKey(),
        ) as Members | undefined;
        queryClient.setQueryData<Members | undefined>(
          trpc.brand.members.queryKey(),
          (old) => {
            const current = (old ?? []) as Members;
            return current.map((m) =>
              m.user?.id === variables.user_id
                ? { ...m, role: variables.role }
                : m,
            ) as Members;
          },
        );
        return { previous } as const;
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData<Members | undefined>(
            trpc.brand.members.queryKey(),
            ctx.previous,
          );
        }
        toast.error("Action failed, please try again");
      },
      onSuccess: (_data, variables) => {
        const roleText = variables.role === "owner" ? "Owner" : "Member";
        toast.success(`Role changed to ${roleText}`);
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.members.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "brand.canLeave" ||
            (Array.isArray(query.queryKey[0]) &&
              query.queryKey[0]?.[0] === "brand" &&
              query.queryKey[0]?.[1] === "canLeave"),
        });
      },
    }),
  );

  const deleteMemberMutation = useMutation(
    trpc.brand.deleteMember.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.brand.members.queryKey(),
        });
        const previous = queryClient.getQueryData(
          trpc.brand.members.queryKey(),
        ) as Members | undefined;

        // Find the member to get their email for the toast
        const memberToDelete = previous?.find(
          (m) => m.user?.id === variables.user_id,
        );
        const memberEmail = memberToDelete?.user?.email || "user";

        queryClient.setQueryData<Members | undefined>(
          trpc.brand.members.queryKey(),
          (old) => {
            const current = (old ?? []) as Members;
            return current.filter(
              (m) => m.user?.id !== variables.user_id,
            ) as Members;
          },
        );
        return { previous, memberEmail } as const;
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData<Members | undefined>(
            trpc.brand.members.queryKey(),
            ctx.previous,
          );
        }
        toast.error("Action failed, please try again");
      },
      onSuccess: (_data, _vars, ctx) => {
        const memberEmail = ctx?.memberEmail || "user";
        toast.success(`Removed ${memberEmail}`);
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.members.queryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.list.queryKey(),
        });
        await queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "brand.canLeave" ||
            (Array.isArray(query.queryKey[0]) &&
              query.queryKey[0]?.[0] === "brand" &&
              query.queryKey[0]?.[1] === "canLeave"),
        });
      },
    }),
  );

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
          path={membership.user?.avatarPath ?? null}
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
                <DropdownMenuItem
                  disabled={membership.role === "owner"}
                  onClick={() =>
                    updateMemberMutation.mutate({
                      user_id: membership.user?.id as string,
                      role: "owner",
                    })
                  }
                >
                  Owner
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={membership.role === "member"}
                  onClick={() =>
                    updateMemberMutation.mutate({
                      user_id: membership.user?.id as string,
                      role: "member",
                    })
                  }
                >
                  Member
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              disabled={!!isSelf}
              className={isSelf ? undefined : "text-destructive"}
              onClick={() =>
                deleteMemberMutation.mutate({
                  user_id: membership.user?.id as string,
                })
              }
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
    trpc.brand.revokeInvite.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: trpc.brand.listInvites.queryKey(),
        });

        const previous = queryClient.getQueryData(
          trpc.brand.listInvites.queryKey(),
        ) as ListInvites | undefined;

        queryClient.setQueryData<ListInvites | undefined>(
          trpc.brand.listInvites.queryKey(),
          (old) =>
            old
              ? ({
                  data: old.data.filter((i) => i.id !== variables.invite_id),
                } as ListInvites)
              : old,
        );

        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(
            trpc.brand.listInvites.queryKey(),
            ctx.previous,
          );
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.brand.listInvites.queryKey(),
        });
      },
    }),
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

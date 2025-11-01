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

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MembersWithInvites = RouterOutputs["composite"]["membersWithInvites"];
type MemberRow = MembersWithInvites["members"][number];
type InviteRow = MembersWithInvites["invites"][number];

type Props =
  | {
      membership: MemberRow;
      brandId: string;
      currentUserId: string | null;
      locale: string;
    }
  | { invite: InviteRow; brandId: string; locale: string };

export function MembersRow(props: Props) {
  if ("membership" in props) {
    return (
      <MembershipRow
        brandId={props.brandId}
        membership={props.membership}
        currentUserId={props.currentUserId}
      />
    );
  }

  return <InviteRowComp invite={props.invite} brandId={props.brandId} />;
}

function MembershipRow({
  brandId,
  membership,
  currentUserId,
}: {
  brandId: string;
  membership: MemberRow;
  currentUserId: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.composite.membersWithInvites.queryKey({
    brand_id: brandId,
  });

  const displayName = membership.full_name ?? membership.email ?? undefined;
  const email = membership.email ?? "";
  const roleLabel = membership.role === "owner" ? "Owner" : "Member";
  const isSelf = currentUserId != null && membership.user_id === currentUserId;

  const updateMemberMutation = useMutation(
    trpc.workflow.members.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey) as
          | MembersWithInvites
          | undefined;

        if (previous && variables.user_id && variables.role) {
          queryClient.setQueryData(queryKey, {
            ...previous,
            members: previous.members.map((member) =>
              member.user_id === variables.user_id
                ? { ...member, role: variables.role }
                : member,
            ),
          });
        }

        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(queryKey, ctx.previous);
        }
        toast.error("Action failed, please try again");
      },
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.workflowInit.queryKey(),
          }),
        ]);
      },
    }),
  );

  const deleteMemberMutation = useMutation(
    trpc.workflow.members.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey) as
          | MembersWithInvites
          | undefined;

        if (previous && variables.user_id) {
          queryClient.setQueryData(queryKey, {
            ...previous,
            members: previous.members.filter(
              (member) => member.user_id !== variables.user_id,
            ),
          });
        }

        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(queryKey, ctx.previous);
        }
        toast.error("Action failed, please try again");
      },
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
          queryClient.invalidateQueries({
            queryKey: trpc.workflow.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.workflowInit.queryKey(),
          }),
        ]);
      },
    }),
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar bucket="avatars" size={32} name={displayName} />
        <div className="flex flex-col">
          <span className="type-p !font-medium">{email}</span>
          <span className="type-p text-secondary">{roleLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
                      brand_id: brandId,
                      user_id: membership.user_id ?? undefined,
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
                      brand_id: brandId,
                      user_id: membership.user_id ?? undefined,
                      role: "member",
                    })
                  }
                >
                  Member
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              disabled={Boolean(isSelf)}
              className={isSelf ? undefined : "text-destructive"}
              onClick={() =>
                deleteMemberMutation.mutate({
                  brand_id: brandId,
                  user_id: membership.user_id ?? undefined,
                  role: null,
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
  brandId,
}: {
  invite: InviteRow;
  brandId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.composite.membersWithInvites.queryKey({
    brand_id: brandId,
  });

  const revokeInviteMutation = useMutation(
    trpc.workflow.invites.respond.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey) as
          | MembersWithInvites
          | undefined;

        if (previous) {
          queryClient.setQueryData(queryKey, {
            ...previous,
            invites: previous.invites.filter((item) => item.id !== invite.id),
          });
        }

        return { previous } as const;
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(queryKey, ctx.previous);
        }
        toast.error("Action failed, please try again");
      },
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
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

  async function onWithdraw() {
    await revokeInviteMutation.mutateAsync({
      invite_id: invite.id,
      action: "revoke",
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar bucket="brand-avatars" size={32} name={invite.email} />
        <div className="flex flex-col">
          <span className="type-p !font-medium">{invite.email}</span>
          <span className="type-p text-secondary">
            Invited as {invite.role === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {invite.invited_by ? (
          <span className="type-p text-tertiary">
            Invited by {invite.invited_by}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          aria-label="Withdraw invite"
          onClick={onWithdraw}
        >
          <Icons.Trash className="w-4 h-4" strokeWidth={1} />
        </Button>
      </div>
    </div>
  );
}

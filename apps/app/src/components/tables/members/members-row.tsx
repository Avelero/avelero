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

/** tRPC router output types for type-safe components */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Combined members and invites data shape */
type MembersWithInvites = RouterOutputs["composite"]["membersWithInvites"];

/** Active brand member data */
type MemberRow = MembersWithInvites["members"][number];

/** Pending invitation data */
type InviteRow = MembersWithInvites["invites"][number];

/**
 * Props for MembersRow - discriminated union for member vs invite display.
 *
 * Supports two modes:
 * - Existing membership: Shows member with role management actions
 * - Pending invite: Shows invite with revoke action
 */
type Props =
  | {
      /** Active brand membership to display */
      membership: MemberRow;
      /** Brand ID for scoped operations */
      brandId: string;
      /** Current user's ID to determine if viewing own membership */
      currentUserId: string | null;
    }
  | {
      /** Pending invitation to display */
      invite: InviteRow;
      /** Brand ID for scoped operations */
      brandId: string;
    };

/**
 * Displays a single row in the members table, supporting both active members
 * and pending invites.
 *
 * Uses discriminated union to render different UI based on whether the row
 * represents an existing member or a pending invitation. Members can have
 * their roles changed or be removed, while invites can be revoked.
 *
 * @param props - Either a membership or invite record with brand context
 *
 * @example
 * ```tsx
 * // Render active member
 * <MembersRow
 *   membership={member}
 *   brandId={brandId}
 *   currentUserId={currentUser.id}
 * />
 *
 * // Render pending invite
 * <MembersRow invite={invite} brandId={brandId} />
 * ```
 */
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

/**
 * Renders an active brand member row with role management controls.
 *
 * Displays member avatar, email, and current role. Owners can change member
 * roles (promote to owner, demote to member) or remove members entirely.
 * Users cannot remove themselves - they must use the "Leave Brand" function.
 *
 * Implements optimistic updates for both role changes and member removal.
 *
 * @param props - Member data and brand context
 */
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
  const queryKey = trpc.composite.membersWithInvites.queryKey({});

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
          const nextRole = variables.role as "owner" | "member";
          queryClient.setQueryData(queryKey, {
            ...previous,
            members: previous.members.map((member) =>
              member.user_id === variables.user_id
                ? { ...member, role: nextRole }
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
        <SignedAvatar
          bucket="avatars"
          size={32}
          name={displayName}
          url={membership.avatar_url}
          hue={membership.avatar_hue}
        />
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
              disabled={Boolean(isSelf) || !membership.user_id}
              className={
                isSelf || !membership.user_id ? undefined : "text-destructive"
              }
              onClick={() =>
                deleteMemberMutation.mutate({
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

/**
 * Formats the time remaining until an invite expires in a human-readable format.
 * Shows days, hours, or minutes depending on how much time remains.
 *
 * @param expiresAt - ISO date string of when the invite expires
 * @returns Formatted string like "Invite expires in 5 days" or "Expired"
 */
function formatExpiresIn(expiresAt: string | null): string {
  if (!expiresAt) return "";

  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const diffMs = expiryDate.getTime() - now.getTime();

  // Already expired
  if (diffMs <= 0) {
    return "Expired";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `Invite expires in ${diffDays} ${diffDays === 1 ? "day" : "days"}`;
  }

  if (diffHours > 0) {
    return `Invite expires in ${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;
  }

  if (diffSeconds < 60) {
    return "Invite expires in less than a minute";
  }

  return `Invite expires in ${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"}`;
}

/**
 * Renders a pending invitation row with revoke action.
 *
 * Displays the invitee's email, invited role, and who sent the invitation.
 * Provides a button to withdraw the invitation before it's accepted.
 *
 * Implements optimistic updates to immediately remove the invite from the UI
 * when revoked, rolling back on error.
 *
 * @param props - Invitation data and brand context
 */
function InviteRowComp({
  invite,
  brandId,
}: {
  invite: InviteRow;
  brandId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.composite.membersWithInvites.queryKey({});

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
            queryKey: trpc.workflow.invites.list.queryKey({}),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.membersWithInvites.queryKey({}),
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
        <div className="flex flex-col">
          <span className="type-p !font-medium">{invite.email}</span>
          <span className="type-p text-secondary">
            Invited as {invite.role === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {invite.expires_at ? (
          <span className="type-p text-tertiary">
            {formatExpiresIn(invite.expires_at)}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          aria-label="Withdraw invite"
          onClick={onWithdraw}
        >
          <Icons.Trash2 className="w-4 h-4" strokeWidth={1} />
        </Button>
      </div>
    </div>
  );
}

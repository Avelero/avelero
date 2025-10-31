"use client";

import { LeaveBrandModal } from "@/components/modals/leave-brand-modal";
import { SignedAvatar } from "@/components/signed-avatar";
import { useSetActiveBrandMutation } from "@/hooks/use-brand";
import {
  useAcceptInviteMutation,
  useRejectInviteMutation,
} from "@/hooks/use-invites";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

interface BrandWithRole {
  id: string;
  name: string;
  logo_path?: string | null;
  avatar_hue?: number | null;
  role: "owner" | "member" | null;
}

interface InviteRow {
  id: string;
  role: "owner" | "member";
  brand_name: string;
  brand_logo?: string | null;
}

type Props = { membership: BrandWithRole } | { invite: InviteRow };

export function BrandsRow(props: Props) {
  if ("membership" in props)
    return <MembershipRow membership={props.membership} />;
  return <InviteRowComp invite={props.invite} />;
}

function MembershipRow({ membership }: { membership: BrandWithRole }) {
  const setActive = useSetActiveBrandMutation();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const [leaveOpen, setLeaveOpen] = useState(false);
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar
          bucket="brand-avatars"
          path={membership.logo_path ?? null}
          hue={membership.avatar_hue ?? undefined}
          size={32}
          name={membership.name}
        />
        <div className="flex flex-col">
          <span className="type-p !font-medium">{membership.name}</span>
          <span className="type-p text-secondary">
            {membership.role === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setActive.mutate(
              { id: membership.id },
              {
                onSuccess: () => {
                  router.push(`/${locale}`);
                },
              },
            )
          }
        >
          Open
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Brand options">
              <Icons.EllipsisVertical className="w-4 h-4" strokeWidth={1} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => {
                // Let Radix close the dropdown first, then open the modal
                setTimeout(() => setLeaveOpen(true), 0);
              }}
            >
              Leave brand
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <LeaveBrandModal
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          brandId={membership.id}
          brandName={membership.name}
          role={membership.role}
        />
      </div>
    </div>
  );
}

function InviteRowComp({ invite }: { invite: InviteRow }) {
  const accept = useAcceptInviteMutation();
  const reject = useRejectInviteMutation();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar
          bucket="brand-avatars"
          path={invite.brand_logo ?? null}
          size={32}
          name={invite.brand_name}
        />
        <div className="flex flex-col">
          <span className="type-p !font-medium">{invite.brand_name}</span>
          <span className="type-p text-secondary">
            {invite.role === "owner" ? "Owner" : "Member"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => reject.mutate({ id: invite.id })}
          aria-label="Reject"
        >
          <Icons.X className="w-4 h-4" strokeWidth={1} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            accept.mutate(
              { id: invite.id },
              {
                onSuccess: () => {
                  router.push(`/${locale}`);
                },
              },
            )
          }
          aria-label="Accept"
        >
          <Icons.Check className="w-4 h-4" strokeWidth={1} />
        </Button>
      </div>
    </div>
  );
}

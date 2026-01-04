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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BrandWithRole {
  id: string;
  name: string;
  logoUrl?: string | null;
  role: "owner" | "member" | null;
  canLeave: boolean;
  email?: string | null;
  countryCode?: string | null;
}

interface InviteRow {
  id: string;
  role: string;
  brand_id?: string | null;
  brand_name: string | null;
  brand_logo: string | null;
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
  const [leaveOpen, setLeaveOpen] = useState(false);
  const isSwitching = setActive.isPending;

  // Prefetch dashboard route for post-activation navigation
  useEffect(() => {
    router.prefetch("/");
  }, [router]);
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar
          bucket="brand-avatars"
          id={membership.id}
          url={membership.logoUrl ?? undefined}
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
          disabled={isSwitching}
          onClick={() => setActive.mutate({ brand_id: membership.id })}
        >
          {isSwitching ? "Switching..." : "Open"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isSwitching}>
            <Button
              variant="outline"
              size="icon"
              disabled={isSwitching}
              aria-label="Brand options"
            >
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
  const setActiveBrand = useSetActiveBrandMutation();
  const accept = useAcceptInviteMutation({
    setActiveBrand: setActiveBrand.mutate,
  });
  const reject = useRejectInviteMutation();
  const router = useRouter();

  const isProcessing =
    accept.isPending || reject.isPending || setActiveBrand.isPending;

  // Prefetch dashboard route for post-acceptance navigation
  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SignedAvatar
          bucket="brand-avatars"
          id={invite.brand_id ?? invite.id}
          url={invite.brand_logo}
          name={invite.brand_name ?? undefined}
          size={32}
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
          disabled={isProcessing}
          onClick={() =>
            reject.mutate({ invite_id: invite.id })
          }
          aria-label="Reject"
        >
          <Icons.X className="w-4 h-4" strokeWidth={1} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={isProcessing}
          onClick={() =>
            accept.mutate({ invite_id: invite.id })
          }
          aria-label="Accept"
        >
          <Icons.Check className="w-4 h-4" strokeWidth={1} />
        </Button>
      </div>
    </div>
  );
}

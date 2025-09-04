"use client";

import { InviteModal } from "@/components/modals/invite-modal";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { useRouter } from "next/navigation";

interface Props {
  activeTab: "members" | "invites";
  onTabChange: (tab: "members" | "invites") => void;
  locale: string;
  brandId?: string;
}

export function MembersHeader({
  activeTab,
  onTabChange,
  locale,
  brandId,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === "members" ? "outline" : "ghost"}
          onClick={() => onTabChange("members")}
          className={cn(
            activeTab === "members"
              ? "!font-medium hover:bg-background hover:cursor-default w-[96px]"
              : "text-secondary hover:text-foreground hover:bg-transparent w-[96px]",
          )}
        >
          Members
        </Button>
        <Button
          variant={activeTab === "invites" ? "outline" : "ghost"}
          onClick={() => onTabChange("invites")}
          className={cn(
            activeTab === "invites"
              ? "!font-medium hover:bg-background hover:cursor-default w-[81px]"
              : "text-secondary hover:text-foreground hover:bg-transparent w-[81px]",
          )}
        >
          Invites
        </Button>
      </div>

      {brandId ? (
        <InviteModal brandId={brandId} />
      ) : (
        <Button variant="outline" disabled>
          Invite member
        </Button>
      )}
    </div>
  );
}

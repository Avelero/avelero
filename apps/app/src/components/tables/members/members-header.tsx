"use client";

import { InviteModal } from "@/components/modals/invite-modal";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";

interface Props {
  activeTab: "members" | "invites";
  onTabChange: (tab: "members" | "invites") => void;
  brandId?: string;
  /** Whether the current user is an owner of this brand */
  isOwner?: boolean;
}

export function MembersHeader({ activeTab, onTabChange, brandId, isOwner = false }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === "members" ? "outline" : "ghost"}
          onClick={() => onTabChange("members")}
          className={cn(
            activeTab === "members"
              ? "!font-medium hover:bg-background hover:cursor-default w-[96px]"
              : "!font-medium text-secondary hover:text-primary hover:bg-transparent w-[96px]",
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
              : "!font-medium text-secondary hover:text-primary hover:bg-transparent w-[81px]",
          )}
        >
          Invites
        </Button>
      </div>

      {brandId && isOwner ? (
        <InviteModal brandId={brandId} />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" disabled>
                  Invite member
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Only brand owners can send invites</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

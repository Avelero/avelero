"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";

interface Props {
  activeTab: "brands" | "invites";
  onTabChange: (tab: "brands" | "invites") => void;
  showBrandsTab?: boolean;
}

export function BrandsHeader({
  activeTab,
  onTabChange,
  showBrandsTab = true,
}: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {showBrandsTab ? (
          <Button
            variant={activeTab === "brands" ? "outline" : "ghost"}
            onClick={() => onTabChange("brands")}
            className={cn(
              activeTab === "brands"
                ? "!font-medium hover:bg-background hover:cursor-default w-[84px]"
                : "!font-medium text-secondary hover:text-primary hover:bg-transparent w-[84px]",
            )}
          >
            Brands
          </Button>
        ) : null}
        <Button
          variant={activeTab === "invites" ? "outline" : "ghost"}
          onClick={() => {
            if (showBrandsTab) onTabChange("invites");
          }}
          className={cn(
            activeTab === "invites"
              ? "!font-medium hover:bg-background hover:cursor-default w-[81px]"
              : "!font-medium text-secondary hover:text-primary hover:bg-transparent w-[81px]",
          )}
        >
          Invites
        </Button>
      </div>

    </div>
  );
}

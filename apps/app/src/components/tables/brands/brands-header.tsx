"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import Link from "next/link";

interface Props {
  activeTab: "brands" | "invites";
  onTabChange: (tab: "brands" | "invites") => void;
  locale: string;
}

export function BrandsHeader({ activeTab, onTabChange, locale }: Props) {

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === "brands" ? "outline" : "ghost"}
          onClick={() => onTabChange("brands")}
          className={cn(
            activeTab === "brands"
              ? "!font-medium hover:bg-background hover:cursor-default w-[84px]"
              : "text-secondary hover:text-foreground hover:bg-transparent w-[84px]",
          )}
        >
          Brands
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

      <Button asChild>
        <Link href={`/${locale}/create-brand`}>
          Create brand
        </Link>
      </Button>
    </div>
  );
}

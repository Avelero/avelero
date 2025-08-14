"use client";

import { cn } from "@v1/ui/cn";
import { useState } from "react";
import { MainMenu } from "./main-menu";
import { BrandDropdown } from "./brand-dropdown";

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen mt-[70px] flex-shrink-0 flex-col desktop:overflow-hidden desktop:rounded-tl-[10px] desktop:rounded-bl-[10px] justify-between fixed top-0 pb-4 items-center hidden md:flex z-50 transition-all duration-200 ease-&lsqb;cubic-bezier(0.4,0,0.2,1)&rsqb;",
        "bg-background border-r border-border",
        isExpanded ? "w-[240px]" : "w-[70px]",
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >

      <BrandDropdown isExpanded={isExpanded} />

      <div className="flex flex-col w-full pt-[70px] flex-1">
        <MainMenu isExpanded={isExpanded} />
      </div>
    </aside>
  );
}
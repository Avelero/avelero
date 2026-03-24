"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { usePlanSelector } from "./plan-selector-context";

interface TrialSidebarCardProps {
  isExpanded: boolean;
  daysRemaining: number;
}

export function TrialSidebarCard({
  isExpanded,
  daysRemaining,
}: TrialSidebarCardProps) {
  const { open } = usePlanSelector();
  const isLastDay = daysRemaining <= 0;

  const label = isLastDay
    ? "Trial ends today"
    : `Trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  return (
    <div className="group relative h-10">
      <button
        type="button"
        onClick={open}
        className="relative block h-10 w-full text-left"
      >
        {/* Ghost button background — accent fill on hover, no rounded corners */}
        <div className="absolute top-0 left-0 right-0 h-10 group-hover:bg-accent" />

        {/* Icon block: fixed 40x40, matches SidebarButton layout */}
        <div className="absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center pointer-events-none">
          <Icons.Clock
            className={cn(
              "w-5 h-5",
              "text-secondary group-hover:text-primary",
            )}
          />
        </div>

        {/* Label: fades in on expand, matches SidebarButton transition */}
        <div
          className={cn(
            "absolute inset-y-0 left-10 right-2 flex items-center pointer-events-none",
            "transition-opacity duration-150 ease-out",
            isExpanded ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="text-sm leading-[21px] font-medium truncate text-secondary group-hover:text-primary">
            {label}
          </span>
        </div>
      </button>
    </div>
  );
}

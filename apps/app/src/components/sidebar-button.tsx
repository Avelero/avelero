"use client";

import { cn } from "@v1/ui/cn";
import Link from "next/link";
import type { ComponentType } from "react";

interface ItemData {
  path: string;
  name: string;
  children?: { path: string; name: string }[];
}

type IconType = ComponentType<{ size?: number; className?: string }>;

interface SidebarButtonProps {
  item: ItemData;
  icon: IconType;
  isActive: boolean;
  isExpanded: boolean;
  isItemExpanded: boolean;
  onToggle: (path: string) => void;
  onSelect?: () => void;
}

export function SidebarButton({
  item,
  icon: Icon,
  isActive,
  isExpanded,
  isItemExpanded, // reserved for nested items
  onToggle,       // reserved for nested items
  onSelect,
}: SidebarButtonProps) {
  return (
    <div className="group relative h-10">
      <Link
        prefetch
        href={item.path}
        onClick={() => onSelect?.()}
        aria-current={isActive ? "page" : undefined}
        className="relative block h-10 overflow-hidden"
      >
        {/* Expanding rail: 40px when collapsed, full inner width when expanded */}
        <div
          className={cn(
            "absolute top-0 h-10 border border-transparent",
            "transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isExpanded ? "left-0 right-0" : "left-0 w-10",
            isActive ? "bg-accent-blue" : "group-hover:bg-accent"
          )}
        />

        {/* Icon block: fixed 40×40, anchored to inner left edge */}
        <div className="absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center text-primary pointer-events-none">
          <Icon
            size={20}
            className={cn(
              "transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
              isActive ? "text-brand" : "group-hover:text-primary"
            )}
          />
        </div>

        {/* Label: always mounted, fades in on expand. Starts at 48px (40 icon + 8 gap). */}
        <div
          className={cn(
            "absolute inset-y-0 left-10 right-2 flex items-center pointer-events-none",
            "transition-opacity duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isExpanded ? "opacity-100" : "opacity-0"
          )}
        >
          <span
            className={cn(
              "text-sm leading-[21px] font-medium truncate",
              isActive ? "text-brand font-medium" : "text-secondary group-hover:text-primary",
              "transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]"
            )}
          >
            {item.name}
          </span>
        </div>
      </Link>
    </div>
  );
}
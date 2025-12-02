"use client";

import { cn } from "@v1/ui/cn";
import { LordIcon, type LottieRefCurrentProps } from "@v1/ui/lord-icon";
import Link from "next/link";
import { useRef } from "react";
import type { LucideIcon } from "lucide-react";

interface ItemData {
  path?: string;
  name: string;
  children?: { path: string; name: string }[];
}

interface SidebarButtonProps {
  item: ItemData;
  animationData?: object;
  icon?: LucideIcon;
  isActive: boolean;
  isExpanded: boolean;
  isItemExpanded?: boolean;
  onToggle?: (path: string) => void;
  onSelect?: () => void;
  onClick?: () => void;
}

export function SidebarButton({
  item,
  animationData,
  icon: Icon,
  isActive,
  isExpanded,
  isItemExpanded, // reserved for nested items
  onToggle, // reserved for nested items
  onSelect,
  onClick,
}: SidebarButtonProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const handleMouseEnter = () => {
    // Stop and reset to beginning, then play once
    lottieRef.current?.stop();
    lottieRef.current?.play();
  };

  const handleMouseLeave = () => {
    // Stop and reset to beginning so it's ready for next hover
    lottieRef.current?.stop();
  };

  // Shared content for both Link and button
  const content = (
    <>
      {/* Expanding rail with gradient border and background when active */}
      {isActive ? (
        <div
          className="absolute top-0 left-0 right-0 h-10"
          style={{
            background:
              "linear-gradient(90deg, hsl(240, 32%, 89%) 0%, hsl(240, 11%, 89%) 100%)",
          }}
        >
          <div
            className="absolute inset-[1px]"
            style={{
              background:
                "linear-gradient(90deg, hsl(240, 29%, 97%) 0%, hsl(240, 8%, 97%) 100%)",
            }}
          />
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 h-10 border border-transparent" />
      )}

      {/* Icon block: fixed 40×40, anchored to inner left edge */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center pointer-events-none",
          "transition-colors duration-200 ease-out",
          isActive
            ? "text-primary"
            : "text-secondary group-hover:text-primary",
        )}
      >
        {Icon ? (
          <Icon className="w-5 h-5" />
        ) : animationData ? (
          <LordIcon
            animationData={animationData}
            style={{ width: 20, height: 20 }}
            loop={false}
            autoplay={false}
            lottieRef={lottieRef}
          />
        ) : null}
      </div>

      {/* Label: always mounted, fades in on expand. Starts at 48px (40 icon + 8 gap). */}
      <div
        className={cn(
          "absolute inset-y-0 left-10 right-2 flex items-center pointer-events-none",
          "transition-opacity duration-150 ease-out",
          isExpanded ? "opacity-100" : "opacity-0",
        )}
      >
        <span
          className={cn(
            "text-sm leading-[21px] font-medium truncate",
            "transition-colors duration-200 ease-out",
            isActive
              ? "text-primary"
              : "text-secondary group-hover:text-primary",
          )}
        >
          {item.name}
        </span>
      </div>
    </>
  );

  return (
    <div
      className="group relative h-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {item.path ? (
        <Link
          prefetch
          href={item.path}
          onClick={() => onSelect?.()}
          aria-current={isActive ? "page" : undefined}
          className="relative block h-10"
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="relative block h-10 w-full text-left"
        >
          {content}
        </button>
      )}
    </div>
  );
}

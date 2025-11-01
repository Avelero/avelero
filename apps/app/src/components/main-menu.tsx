"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarButton } from "./sidebar-button";
import dashboardAnimation from "@/animations/avelero-icon-animation.json";
import passportsAnimation from "@/animations/system-regular-727-spinner-dashes-hover-rotation.json";
import analyticsAnimation from "@/animations/system-regular-10-analytics-hover-analytics.json";
import settingsAnimation from "@/animations/system-regular-63-settings-cog-hover-cog-1.json";

const animations = {
  "/": dashboardAnimation,
  "/passports": passportsAnimation,
  "/analytics": analyticsAnimation,
  "/settings": settingsAnimation,
} as const;

const items = [
  { path: "/", name: "Dashboard" },
  { path: "/passports", name: "Passports" },
  { path: "/analytics", name: "Analytics" },
  { path: "/settings", name: "Settings" },
] as const;

type Props = {
  onSelectAction?: () => void;
  isExpanded?: boolean;
};

export function MainMenu({ onSelectAction, isExpanded = false }: Props) {
  const pathname = usePathname();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    setExpandedItem(null);
  }, [isExpanded]);

  return (
    <nav>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          // Special handling for root path to avoid matching all paths
          const isActive = item.path === "/" 
            ? pathname === "/" 
            : (pathname?.startsWith(item.path) ?? false);
          const animationData = animations[item.path as keyof typeof animations];

          return (
            <SidebarButton
              key={item.path}
              item={item}
              animationData={animationData}
              isActive={isActive}
              isExpanded={isExpanded}
              isItemExpanded={expandedItem === item.path}
              onToggle={(path) =>
                setExpandedItem(expandedItem === path ? null : path)
              }
              onSelect={onSelectAction}
            />
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import { Icons } from "@v1/ui/icons";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarButton } from "./sidebar-button";

const icons = {
  "/passports": Icons.QrCode,
  "/analytics": Icons.ChartLine,
  "/settings": Icons.Settings,
} as const;

const items = [
  { path: "/passports", name: "Passports" },
  { path: "/analytics", name: "Analytics" },
  { path: "/settings",  name: "Settings"  },
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
          const isActive = pathname?.startsWith(item.path) ?? false;
          const Icon = icons[item.path as keyof typeof icons];

          return (
            <SidebarButton
              key={item.path}
              item={item}
              icon={Icon}
              isActive={isActive}
              isExpanded={isExpanded}
              isItemExpanded={expandedItem === item.path}
              onToggle={(path) => setExpandedItem(expandedItem === path ? null : path)}
              onSelect={onSelectAction}
            />
          );
        })}
      </div>
    </nav>
  );
}
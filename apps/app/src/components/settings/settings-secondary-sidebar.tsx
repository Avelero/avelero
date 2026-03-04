"use client";

import {
  SETTINGS_NAV_GROUPS,
  getActiveSettingsNavItem,
  type SettingsNavIconKey,
} from "@/lib/settings-navigation";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_NAV_ICONS: Record<SettingsNavIconKey, LucideIcon> = {
  SlidersHorizontal: Icons.SlidersHorizontal,
  UserRound: Icons.UserRound,
  Layers: Icons.Layers,
  FileText: Icons.FileText,
  Calendar: Icons.Calendar,
  Tag: Icons.Tag,
  Bookmark: Icons.Bookmark,
  Factory: Icons.Factory,
  Leaf: Icons.Leaf,
  Award: Icons.Award,
  Building: Icons.Building,
};

export function SettingsSecondarySidebar() {
  const pathname = usePathname();
  const activeItem = getActiveSettingsNavItem(pathname);

  return (
    <aside className="w-[244px] shrink-0 border-r border-border bg-background">
      <nav className="h-full overflow-y-auto p-2" aria-label="Settings navigation">
        <div className="flex flex-col gap-4">
          {SETTINGS_NAV_GROUPS.map((group) => (
            <section key={group.label} className="flex flex-col">
              {group.label !== "Brand" ? (
                <p className="px-2 pb-2 type-small text-secondary !font-medium">
                  {group.label}
                </p>
              ) : null}

              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = SETTINGS_NAV_ICONS[item.icon];
                  const isActive = activeItem?.href === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      aria-current={isActive ? "page" : undefined}
                      className="group relative block h-8 focus-visible:outline-none"
                    >
                      {isActive ? (
                        <div
                          className="absolute inset-0"
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
                        <div className="absolute inset-0 border border-transparent" />
                      )}

                      <div className="relative z-10 flex h-8 items-center gap-2 px-2">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive
                              ? "text-primary"
                              : "text-secondary group-hover:text-primary",
                          )}
                        />
                        <span
                          className={cn(
                            "truncate type-small !font-semimedium",
                            isActive
                              ? "text-primary"
                              : "text-secondary group-hover:text-primary",
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </aside>
  );
}

"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Brands",
    icon: Icons.Overview,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/brands/create",
    label: "Create",
    icon: Icons.Plus,
    isActive: (pathname: string) => pathname.startsWith("/brands/create"),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed top-14 z-40 flex h-[calc(100vh_-_56px)] w-14 flex-col gap-2 border-r border-border bg-background p-2",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-label={item.label}
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center border",
              active
                ? "border-border bg-accent text-primary"
                : "border-transparent text-secondary hover:bg-accent-light hover:text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}

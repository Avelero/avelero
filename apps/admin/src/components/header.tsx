"use client";

import { AnimatedAveleroIcon } from "@/components/animated-avelero-icon";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@v1/ui/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

function getTitle(pathname: string) {
  if (pathname === "/") return "Brands";
  if (pathname === "/brands/create") return "Create Brand";
  if (pathname.startsWith("/brands/")) return "Brand Detail";
  return "Admin";
}

export function Header() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b bg-background"
      style={{ height: "56px" }}
    >
      <div className="flex h-full">
        <Link
          href="/"
          className="flex shrink-0 items-center border-r focus-visible:outline-none"
          style={{ width: "56px", height: "56px" }}
          aria-label="Admin home"
          prefetch
        >
          <AnimatedAveleroIcon size={28} className="mx-auto h-14 w-14" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-between px-4">
          <div className={cn("type-h6 text-primary")}>{getTitle(pathname)}</div>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

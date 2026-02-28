"use client";

import { getSettingsHeaderBreadcrumbs } from "@/lib/settings-navigation";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { type BreadcrumbItem, NavigationLabel } from "./navigation-label";

/**
 * Get breadcrumbs for the header based on the current URL.
 */
function getHeaderBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Normalize pathname
  const normalized = pathname.replace(/\/$/, "") || "/";
  const segments = normalized.split("/").filter(Boolean);

  // Root
  if (normalized === "/") {
    return [{ label: "Passports" }];
  }

  // Settings routes
  const settingsBreadcrumbs = getSettingsHeaderBreadcrumbs(normalized);
  if (settingsBreadcrumbs) {
    return settingsBreadcrumbs;
  }

  // Account routes
  if (segments[0] === "account") {
    if (segments.length === 1) {
      return [{ label: "Account" }];
    }
    if (segments[1] === "brands") {
      return [{ label: "Brands" }];
    }
    return [{ label: "Account" }];
  }

  // Passports routes
  if (segments[0] === "passports") {
    if (segments.length === 1) {
      return [{ label: "Passports" }];
    }
    if (segments[1] === "create") {
      return [{ label: "Passports", href: "/passports" }, { label: "Create" }];
    }
    if (segments[1] === "edit") {
      return [{ label: "Passports", href: "/passports" }, { label: "Edit" }];
    }
    return [{ label: "Passports" }];
  }

  // Theme routes
  if (segments[0] === "theme") {
    return [{ label: "Theme" }];
  }

  if (segments[0] === "theme-editor") {
    return [{ label: "Theme editor" }];
  }

  // Other routes
  const routeLabels: Record<string, string> = {
    setup: "Setup",
    invites: "Invites",
    "pending-access": "Pending access",
  };

  const firstSegment = segments[0];
  if (firstSegment && routeLabels[firstSegment]) {
    return [{ label: routeLabels[firstSegment] }];
  }

  return [];
}

/**
 * Header navigation that reads from URL and shows breadcrumbs.
 * Used in the main header component.
 */
export function HeaderNavigation() {
  const pathname = usePathname();
  const items = useMemo(() => getHeaderBreadcrumbs(pathname), [pathname]);

  return <NavigationLabel items={items} />;
}

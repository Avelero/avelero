"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

/**
 * Route definitions for breadcrumbs.
 * Top-level routes (Dashboard, Passports, Settings, Analytics, Account) have no parent.
 * Special routes (Setup, Create Brand) also have no parent.
 * Child routes inherit their parent from the path hierarchy.
 */
const ROUTE_LABELS: Record<string, string> = {
  // Main navigation (top-level, no parents)
  "/": "Dashboard",
  "/passports": "Passports",
  "/settings": "Settings",
  "/analytics": "Analytics",
  "/account": "Account",
  
  // Special pages (no parents)
  "/setup": "Setup",
  "/create-brand": "Create Brand",
  
  // Passports children
  "/passports/create": "Create",
  "/passports/edit": "Edit",
  
  // Account children
  "/account/brands": "Brands",
  
  // Settings children
  "/settings/members": "Members",
};

/**
 * Routes that should NOT show a parent breadcrumb.
 * These are top-level navigation items or special standalone pages.
 */
const TOP_LEVEL_ROUTES = new Set([
  "/",
  "/passports",
  "/settings",
  "/analytics",
  "/account",
  "/setup",
  "/create-brand",
]);

interface BreadcrumbItem {
  label: string;
  href: string;
}

function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  // Normalize pathname - remove locale segment and trailing slash
  const normalized = pathname.replace(/\/[a-z]{2}(\/|$)/, "/").replace(/\/$/, "") || "/";
  
  // If this is a top-level route, return just itself
  if (TOP_LEVEL_ROUTES.has(normalized)) {
    const label = ROUTE_LABELS[normalized];
    if (label) {
      return [{ label, href: normalized }];
    }
  }
  
  // For nested routes, build the trail
  const breadcrumbs: BreadcrumbItem[] = [];
  const segments = normalized.split("/").filter(Boolean);
  
  // Build path progressively and look for matches
  for (let i = 0; i < segments.length; i++) {
    const path = `/${segments.slice(0, i + 1).join("/")}`;
    const label = ROUTE_LABELS[path];
    
    if (label) {
      breadcrumbs.push({ label, href: path });
    }
  }
  
  // If no exact match found but we have segments, try to match parent
  if (breadcrumbs.length === 0 && segments.length > 0) {
    // Check parent paths (useful for dynamic routes like /passports/edit/[id])
    for (let i = segments.length - 1; i > 0; i--) {
      const path = `/${segments.slice(0, i).join("/")}`;
      const label = ROUTE_LABELS[path];
      
      if (label) {
        breadcrumbs.push({ label, href: path });
        break;
      }
    }
  }
  
  return breadcrumbs;
}

export function NavigationLabel() {
  const pathname = usePathname();

  const items = useMemo(() => {
    const breadcrumbs = getBreadcrumbsForPath(pathname);
    
    // Handle ellipsis if we have too many breadcrumbs (> 4)
    if (breadcrumbs.length > 4) {
      const first = breadcrumbs[0];
      const lastTwo = breadcrumbs.slice(-2);
      
      if (first) {
        return [
          first,
          { label: "...", href: "" },
          ...lastTwo,
        ];
      }
    }
    
    return breadcrumbs;
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <nav className="flex items-center type-h6" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={`${item.href}-${item.label}-${index}`} className="flex items-center">
          {index > 0 && <span className="mx-1.5 text-secondary !font-medium" aria-hidden="true">/</span>}
          
          {!item.href ? (
            // Ellipsis
            <span className="text-secondary !font-medium">{item.label}</span>
          ) : index === items.length - 1 ? (
            // Current page (last item) - not clickable
            <span className="text-primary !font-medium" aria-current="page">
              {item.label}
            </span>
          ) : (
            // Clickable parent breadcrumb
            <Link href={item.href} prefetch className="text-secondary !font-medium hover:text-primary transition-colors duration-150">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

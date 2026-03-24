/**
 * Settings navigation metadata used by the sidebar and header breadcrumbs.
 */
export type SettingsNavMatch = "exact" | "prefix";

export type SettingsNavIconKey =
  | "SlidersHorizontal"
  | "UserRound"
  | "Layers"
  | "FileText"
  | "BarChart3"
  | "Calendar"
  | "Tag"
  | "Bookmark"
  | "Factory"
  | "Leaf"
  | "Award"
  | "Building";

export interface SettingsNavItem {
  label: string;
  href: string;
  icon: SettingsNavIconKey;
  match?: SettingsNavMatch;
}

export interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

export interface SettingsHeaderBreadcrumbItem {
  label: string;
  href?: string;
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Brand",
    items: [
      {
        label: "General",
        href: "/settings",
        icon: "SlidersHorizontal",
        match: "exact",
      },
      {
        label: "Members",
        href: "/settings/members",
        icon: "UserRound",
      },
      {
        label: "Integrations",
        href: "/settings/integrations",
        icon: "Layers",
        match: "prefix",
      },
      {
        label: "Billing",
        href: "/settings/billing",
        icon: "FileText",
      },
      {
        label: "Usage",
        href: "/settings/usage",
        icon: "BarChart3",
      },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Seasons", href: "/settings/seasons", icon: "Calendar" },
      { label: "Tags", href: "/settings/tags", icon: "Tag" },
      { label: "Attributes", href: "/settings/attributes", icon: "Bookmark" },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        label: "Manufacturers",
        href: "/settings/manufacturers",
        icon: "Factory",
      },
      { label: "Materials", href: "/settings/materials", icon: "Leaf" },
      {
        label: "Certifications",
        href: "/settings/certifications",
        icon: "Award",
      },
      { label: "Operators", href: "/settings/operators", icon: "Building" },
    ],
  },
];

function normalizePath(pathname: string) {
  // Normalize trailing slashes so route matching is consistent.
  return pathname.replace(/\/+$/, "") || "/";
}

function matchesSettingsNavItem(pathname: string, item: SettingsNavItem) {
  // Match a pathname against a settings nav item using its configured strategy.
  const normalizedPath = normalizePath(pathname);
  const normalizedHref = normalizePath(item.href);
  const match = item.match ?? "exact";

  if (match === "prefix") {
    return (
      normalizedPath === normalizedHref ||
      normalizedPath.startsWith(`${normalizedHref}/`)
    );
  }

  return normalizedPath === normalizedHref;
}

function getAllSettingsNavItems() {
  // Flatten grouped settings nav items into a single list for lookups.
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items);
}

function decodeSlug(slug: string) {
  // Decode URL-safe slugs without throwing on malformed input.
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function formatSettingsDetailLabel(slug: string) {
  // Convert a route slug into a human-readable breadcrumb label.
  return decodeSlug(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getActiveSettingsNavItem(pathname: string) {
  // Resolve the active settings nav item for the current pathname.
  const normalizedPath = normalizePath(pathname);

  for (const item of getAllSettingsNavItems()) {
    if (matchesSettingsNavItem(normalizedPath, item)) {
      return item;
    }
  }

  return null;
}

export function getSettingsHeaderBreadcrumbs(
  pathname: string,
): SettingsHeaderBreadcrumbItem[] | null {
  // Build settings-specific header breadcrumbs from the current pathname.
  const normalizedPath = normalizePath(pathname);
  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments[0] !== "settings") {
    return null;
  }

  if (segments[1] === "integrations" && segments[2]) {
    const integrationsItem = getAllSettingsNavItems().find(
      (item) => item.href === "/settings/integrations",
    );
    const slug = segments[2];

    return [
      {
        label: integrationsItem?.label ?? "Integrations",
        href: integrationsItem?.href ?? "/settings/integrations",
      },
      { label: formatSettingsDetailLabel(slug) },
    ];
  }

  const activeItem = getActiveSettingsNavItem(normalizedPath);
  if (activeItem && normalizedPath !== "/settings") {
    return [{ label: activeItem.label }];
  }

  return [{ label: "Settings" }];
}

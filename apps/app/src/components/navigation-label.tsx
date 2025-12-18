"use client";

import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Optional click handler. If provided with href, prevents navigation. */
  onClick?: () => void;
}

interface NavigationLabelProps {
  items: BreadcrumbItem[];
}

/**
 * Presentational breadcrumb component.
 * Pass breadcrumbs as props - no URL coupling.
 */
export function NavigationLabel({ items }: NavigationLabelProps) {
  if (items.length === 0) return null;

  // Handle ellipsis if we have too many breadcrumbs (> 4)
  const displayItems =
    items.length > 4
      ? [items[0], { label: "..." }, ...items.slice(-2)]
      : items;

  return (
    <nav className="flex items-center type-h6" aria-label="Breadcrumb">
      {displayItems.map((item, index) => (
        <div
          key={`${item.href ?? "ellipsis"}-${item.label}-${index}`}
          className="flex items-center"
        >
          {index > 0 && (
            <span
              className="mx-1.5 text-secondary !font-medium"
              aria-hidden="true"
            >
              /
            </span>
          )}

          {!item.href && !item.onClick ? (
            // Static text (ellipsis or final item)
            <span
              className={
                index === displayItems.length - 1
                  ? "text-primary !font-medium"
                  : "text-secondary !font-medium"
              }
              aria-current={index === displayItems.length - 1 ? "page" : undefined}
            >
              {item.label}
            </span>
          ) : index === displayItems.length - 1 && !item.onClick ? (
            // Current page (last item) - not clickable
            <span className="text-primary !font-medium" aria-current="page">
              {item.label}
            </span>
          ) : item.onClick ? (
            // Button with click handler (no navigation)
            <button
              type="button"
              onClick={item.onClick}
              className="text-secondary !font-medium hover:text-primary transition-colors duration-150"
            >
              {item.label}
            </button>
          ) : (
            // Clickable link
            <Link
              href={item.href!}
              prefetch
              className="text-secondary !font-medium hover:text-primary transition-colors duration-150"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface NavigationLabelProps {
  locale?: string;
}

function formatSegment(segment: string): string {
  const words = segment.split("-").filter(Boolean);
  const firstWord = words.at(0);
  if (!firstWord) return "";

  const firstFormatted =
    firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  const restFormatted = words.slice(1).map((w) => w.toLowerCase());
  return [firstFormatted, ...restFormatted].join(" ");
}

function buildBreadcrumbItems(
  segments: string[],
  formattedSegments: string[],
  locale: string,
): Array<{ label: string; href: string; show: boolean }> {
  if (segments.length === 0) {
    return [{ label: "Dashboard", href: `/${locale}`, show: true }];
  }

  if (segments.length <= 3) {
    // Show all segments
    return segments
      .map((_, index) => {
        const label = formattedSegments[index];
        if (!label) return null;
        return {
          label,
          href: `/${locale}/${segments.slice(0, index + 1).join("/")}`,
          show: true,
        };
      })
      .filter(Boolean) as Array<{ label: string; href: string; show: boolean }>;
  }

  // Show first + ellipsis + last two
  const items: Array<{ label: string; href: string; show: boolean }> = [];

  const firstLabel = formattedSegments[0];
  if (firstLabel) {
    items.push({
      label: firstLabel,
      href: `/${locale}/${segments[0]}`,
      show: true,
    });
  }

  items.push({ label: "...", href: "", show: false });

  // Add last two segments
  for (let i = segments.length - 2; i < segments.length; i++) {
    const label = formattedSegments[i];
    if (label) {
      items.push({
        label,
        href: `/${locale}/${segments.slice(0, i + 1).join("/")}`,
        show: true,
      });
    }
  }

  return items;
}

export function NavigationLabel({ locale = "en" }: NavigationLabelProps) {
  const pathname = usePathname();

  const items = useMemo(() => {
    // Remove locale from pathname
    const path = pathname.replace(`/${locale}`, "") || "/";

    // Split path into segments and format them
    const segments = path.split("/").filter(Boolean);
    const formattedSegments = segments.map(formatSegment);

    return buildBreadcrumbItems(segments, formattedSegments, locale);
  }, [pathname, locale]);

  return (
    <nav className="flex items-center text-h6">
      {items.map((item, index) => (
        <div key={`${item.href}-${item.label}`} className="flex items-center">
          {index > 0 && <span className="mx-2 text-secondary">/</span>}
          {!item.show ? (
            <span className="text-secondary">{item.label}</span>
          ) : index === items.length - 1 ? (
            <span className="text-primary !font-medium">{item.label}</span>
          ) : (
            <Link href={item.href} className="text-secondary">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

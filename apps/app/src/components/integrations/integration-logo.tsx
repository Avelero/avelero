"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { ShopifyLogo } from "../logos/shopify-logo";

interface IntegrationLogoProps {
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

/**
 * Logo component for integrations.
 * Displays the integration-specific logo or a fallback icon.
 */
export function IntegrationLogo({ slug, size = "md", className }: IntegrationLogoProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-accent text-secondary",
        sizeClasses[size],
        className,
      )}
    >
      {slug === "shopify" ? (
        <ShopifyLogo className={iconSizes[size]} />
      ) : (
        <Icons.Link className={iconSizes[size]} />
      )}
    </div>
  );
}


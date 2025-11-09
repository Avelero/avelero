"use client";

import { cn } from "@v1/ui/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

interface ControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ControlBarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

interface ControlBarNavButtonProps {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

const ControlBar = React.forwardRef<HTMLDivElement, ControlBarProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "w-full pl-5 pr-6 h-[56px] min-h-[56px] border-b border-border bg-background",
        "flex items-center justify-between flex-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ControlBar.displayName = "ControlBar";

const ControlBarLeft = React.forwardRef<HTMLDivElement, ControlBarSectionProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center h-full gap-2", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
ControlBarLeft.displayName = "ControlBarLeft";

const ControlBarRight = React.forwardRef<
  HTMLDivElement,
  ControlBarSectionProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 h-full", className)}
    {...props}
  >
    {children}
  </div>
));
ControlBarRight.displayName = "ControlBarRight";

function ControlBarNavButton({
  href,
  children,
  isActive: providedIsActive,
  className,
}: ControlBarNavButtonProps) {
  const pathname = usePathname();
  function normalize(path?: string) {
    return (path ?? "").replace(/\/+$/, "");
  }
  const computedActive = normalize(pathname).endsWith(normalize(href));
  const isActive = providedIsActive ?? computedActive;

  return (
    <Link
      href={href}
      className={cn(
        "h-full px-1 flex items-center",
        isActive
          ? "border-b-2 border-primary -mb-px"
          : "border-b border-transparent",
        className,
      )}
    >
      <p
        className={cn(
          "type-p",
          isActive ? "text-primary !font-medium" : "text-secondary",
        )}
      >
        {children}
      </p>
    </Link>
  );
}

export { ControlBar, ControlBarLeft, ControlBarRight, ControlBarNavButton };

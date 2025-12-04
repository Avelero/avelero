"use client";

import { cn } from "@v1/ui/cn";
import { Label } from "@v1/ui/label";

interface FieldWrapperProps {
  label?: string;
  /** Use horizontal layout (label left, input right) - for toggles */
  row?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper component for design panel input fields.
 * Provides consistent label styling and spacing.
 */
export function FieldWrapper({
  label,
  row = false,
  className,
  children,
}: FieldWrapperProps) {
  if (row) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        {label && <span className="type-small text-secondary">{label}</span>}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label variant="small">{label}</Label>}
      {children}
    </div>
  );
}

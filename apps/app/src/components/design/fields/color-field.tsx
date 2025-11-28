"use client";

import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  className?: string;
}

/**
 * Normalizes hex input to ensure consistent format
 */
function normalizeHex(hex: string): string {
  let cleaned = hex.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (cleaned.length > 6) {
    cleaned = cleaned.slice(0, 6);
  }
  return cleaned;
}

/**
 * Validates if a string is a valid hex color
 */
function isValidHex(hex: string): boolean {
  return /^[A-Fa-f0-9]{6}$/.test(hex);
}

export function ColorField({
  label,
  value,
  onChange,
  showOpacity = true,
  opacity = 100,
  onOpacityChange,
  className,
}: ColorFieldProps) {
  const displayValue = normalizeHex(value);
  const backgroundColor = isValidHex(displayValue)
    ? `#${displayValue}`
    : "#FFFFFF";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="type-small text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {/* Hex input with embedded color swatch */}
        <div className="relative flex-1">
          {/* Color swatch inside input */}
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 border border-border"
            style={{ backgroundColor }}
          />
          <Input
            value={displayValue}
            onChange={(e) => {
              const normalized = normalizeHex(e.target.value);
              onChange(normalized);
            }}
            placeholder="FFFFFF"
            className="h-8 pl-9 font-mono text-sm"
          />
        </div>
        {/* Opacity input */}
        {showOpacity && (
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value)));
                onOpacityChange?.(val);
              }}
              className="h-8 w-[72px] pr-6 text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 type-small text-secondary pointer-events-none">
              %
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

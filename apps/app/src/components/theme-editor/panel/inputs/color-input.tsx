"use client";

import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useEffect, useState } from "react";

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  className?: string;
}

/**
 * Normalizes hex input to ensure consistent format (6 characters, RGB only)
 */
function normalizeHex(hex: string): string {
  let cleaned = hex.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (cleaned.length > 6) {
    cleaned = cleaned.slice(0, 6);
  }
  return cleaned;
}

/**
 * Validates if a string is a valid 6-character hex color
 */
function isValidHex(hex: string): boolean {
  return /^[A-Fa-f0-9]{6}$/.test(hex);
}

// =============================================================================
// HEX + OPACITY UTILITIES
// =============================================================================

/**
 * Converts opacity percentage (0-100) to 2-character hex alpha (00-FF)
 */
export function opacityToHexAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(100, opacity));
  const alpha = Math.round((clamped / 100) * 255);
  return alpha.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Converts 2-character hex alpha (00-FF) to opacity percentage (0-100)
 */
export function hexAlphaToOpacity(hexAlpha: string): number {
  const alpha = Number.parseInt(hexAlpha, 16);
  if (Number.isNaN(alpha)) return 100;
  return Math.round((alpha / 255) * 100);
}

/**
 * Parses a hex color (with or without alpha) into RGB and opacity
 * Handles: #RRGGBB, #RRGGBBAA, RRGGBB, RRGGBBAA
 * Returns: { rgb: "RRGGBB", opacity: 0-100 }
 */
export function parseHexWithAlpha(hex: string): {
  rgb: string;
  opacity: number;
} {
  // Remove # prefix if present
  const cleaned = hex.replace(/^#/, "").toUpperCase();

  if (cleaned.length === 8) {
    // 8-char hex: RRGGBBAA
    return {
      rgb: cleaned.slice(0, 6),
      opacity: hexAlphaToOpacity(cleaned.slice(6, 8)),
    };
  }

  // 6-char hex or other: treat as full opacity
  return {
    rgb: cleaned.slice(0, 6),
    opacity: 100,
  };
}

/**
 * Combines RGB hex and opacity (0-100) into hex format
 * Returns "#RRGGBB" for 100% opacity, "#RRGGBBAA" otherwise
 * This ensures reverting to 100% opacity produces the original value format
 */
export function combineHexWithAlpha(rgb: string, opacity: number): string {
  const cleanRgb = rgb.replace(/^#/, "").toUpperCase().slice(0, 6);
  // Always pad to 6 chars so parsing can correctly separate RGB from alpha
  const paddedRgb = cleanRgb.padEnd(6, "0");

  // Return 6-char format for full opacity to match original stored values
  if (opacity >= 100) {
    return `#${paddedRgb}`;
  }

  const alpha = opacityToHexAlpha(opacity);
  return `#${paddedRgb}${alpha}`;
}

export function ColorInput({
  label,
  value,
  onChange,
  showOpacity = true,
  opacity = 100,
  onOpacityChange,
  className,
}: ColorInputProps) {
  // Local state to prevent alpha channel corruption during typing
  // The parent combines RGB with opacity (e.g., "0" + "FF" = "#0FF"),
  // which would corrupt the display on every keystroke. We only commit on blur.
  const [inputValue, setInputValue] = useState(() => normalizeHex(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync from prop when not focused (handles external changes like undo/reset)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(normalizeHex(value));
    }
  }, [value, isFocused]);

  // Show local value during editing, prop value otherwise
  const displayValue = isFocused ? inputValue : normalizeHex(value);
  const isValid = isValidHex(displayValue);
  const rgbColor = isValid ? `#${displayValue}` : "#FFFFFF";
  // Convert opacity percentage to CSS alpha (0-1)
  const alphaValue = Math.max(0, Math.min(100, opacity)) / 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty or partial hex values during typing
    const normalized = normalizeHex(e.target.value);
    setInputValue(normalized);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Only commit on blur - this is when alpha will be combined
    if (inputValue !== normalizeHex(value)) {
      onChange(inputValue);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label variant="small">{label}</Label>
      <div className="flex items-center gap-2">
        {/* Hex input with embedded color swatch */}
        <div className="relative flex-1">
          {/* Color swatch - split: left solid, right with opacity over checkers */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 border border-solid border-border bg-white overflow-hidden flex">
            {/* Left half: solid color (no opacity) */}
            <div
              className="w-1/2 h-full"
              style={{ backgroundColor: rgbColor }}
            />
            {/* Right half: checkered + color with opacity */}
            <div className="w-1/2 h-full relative">
              {/* Checkered pattern */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                  backgroundSize: "6px 6px",
                  backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
                }}
              />
              {/* Color overlay with opacity */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: rgbColor,
                  opacity: alphaValue,
                }}
              />
            </div>
          </div>
          <Input
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="FFFFFF"
            className="h-8 pl-9 font-mono text-sm"
          />
        </div>
        {/* Opacity input */}
        {showOpacity && (
          <div className="relative">
            <Input
              type="number"
              allowEmpty
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                onOpacityChange?.(val);
              }}
              className="h-8 w-[72px] pr-7 text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              %
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

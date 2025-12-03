"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { ColorInput } from "../inputs/color-input";

// Color tokens configuration - matches globals.css color system
const COLOR_TOKENS = [
  // Core colors
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  // Muted colors
  { key: "muted", label: "Muted" },
  { key: "mutedForeground", label: "Muted Foreground" },
  // Accent colors
  { key: "accent", label: "Accent" },
  { key: "accentForeground", label: "Accent Foreground" },
  // Card colors
  { key: "card", label: "Card" },
  { key: "cardForeground", label: "Card Foreground" },
  // Primary colors
  { key: "primary", label: "Primary" },
  { key: "primaryForeground", label: "Primary Foreground" },
  // Status colors
  { key: "destructive", label: "Destructive" },
  { key: "destructiveForeground", label: "Destructive Foreground" },
  { key: "success", label: "Success" },
  { key: "successForeground", label: "Success Foreground" },
  // Utility colors
  { key: "border", label: "Border" },
  { key: "link", label: "Link" },
] as const;

export function ColorsEditor() {
  const { themeStylesDraft, updateColor } = useDesignEditor();

  // Get current color value with default
  const getColorValue = (colorKey: string): string => {
    const colors = themeStylesDraft.colors as
      | Record<string, string | undefined>
      | undefined;
    return colors?.[colorKey] || "";
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
      <div className="flex flex-col gap-4">
        {COLOR_TOKENS.map(({ key, label }) => (
          <ColorInput
            key={key}
            label={label}
            value={getColorValue(key)}
            onChange={(value) => updateColor(key, `#${value}`)}
            showOpacity={false}
          />
        ))}
      </div>
    </div>
  );
}

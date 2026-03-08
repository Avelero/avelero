"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import type { ColorTokenKey } from "@v1/dpp-components";
import { ColorInput, combineHexWithAlpha, parseHexWithAlpha } from "../inputs";

// Color tokens configuration - matches Passport color tokens
const COLOR_TOKENS = [
  // Core colors
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  // Muted colors
  { key: "muted", label: "Muted" },
  { key: "mutedForeground", label: "Muted Foreground" },
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
  const { passportDraft, updateColor } = useDesignEditor();

  const getColorValue = (colorKey: ColorTokenKey): string => {
    return passportDraft.tokens.colors[colorKey] ?? "";
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
      <div className="flex flex-col gap-4">
        {COLOR_TOKENS.map(({ key, label }) => {
          const hexValue = getColorValue(key);
          const { rgb, opacity } = parseHexWithAlpha(hexValue);

          return (
            <ColorInput
              key={key}
              label={label}
              value={rgb}
              opacity={opacity}
              onChange={(newRgb) => {
                updateColor(key, combineHexWithAlpha(newRgb, opacity));
              }}
              onOpacityChange={(newOpacity) => {
                updateColor(key, combineHexWithAlpha(rgb, newOpacity));
              }}
              showOpacity={true}
            />
          );
        })}
      </div>
    </div>
  );
}

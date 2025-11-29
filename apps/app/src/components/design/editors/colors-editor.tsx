"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { ColorField } from "../fields";

// Color tokens configuration
const COLOR_TOKENS = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "highlight", label: "Highlight" },
  { key: "success", label: "Success" },
  { key: "border", label: "Border" },
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
          <ColorField
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


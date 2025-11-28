"use client";

import * as React from "react";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { TypographyScaleEditor, ColorField } from "./fields";
import type { TypographyScale } from "@v1/dpp-components";

// Typography scale configuration
const TYPOGRAPHY_SCALES = [
  { key: "h1" as const, label: "Heading 1" },
  { key: "h2" as const, label: "Heading 2" },
  { key: "h3" as const, label: "Heading 3" },
  { key: "h4" as const, label: "Heading 4" },
  { key: "h5" as const, label: "Heading 5" },
  { key: "h6" as const, label: "Heading 6" },
  { key: "body" as const, label: "Body" },
  { key: "body-sm" as const, label: "Small" },
] as const;

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

type TypographyScaleKey = (typeof TYPOGRAPHY_SCALES)[number]["key"];

// Simple accordion item component
interface AccordionItemProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({ label, isOpen, onToggle, children }: AccordionItemProps) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="type-p text-primary">{label}</span>
        <Icons.ChevronDown
          className={cn(
            "h-4 w-4 text-secondary transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

export function DesignRightPanel() {
  const { themeStylesDraft, updateTypographyScale, updateColor } = useDesignEditor();
  const [openItem, setOpenItem] = React.useState<string | null>(null);

  const toggleItem = (key: string) => {
    setOpenItem((prev) => (prev === key ? null : key));
  };

  // Get current typography values with defaults
  const getTypographyValue = (scale: TypographyScaleKey): TypographyScale => {
    return themeStylesDraft.typography?.[scale] || {};
  };

  // Get current color value with default
  const getColorValue = (colorKey: string): string => {
    const colors = themeStylesDraft.colors as Record<string, string | undefined> | undefined;
    return colors?.[colorKey] || "";
  };

  return (
    <div className="flex h-full w-[300px] flex-col border-l bg-background">
      {/* Header */}
      <div className="flex w-full px-4 py-3 border-b border-border justify-start items-center">
        <p className="type-p !font-medium text-foreground">Theme</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Typography Accordions */}
        {TYPOGRAPHY_SCALES.map(({ key, label }) => (
          <AccordionItem
            key={key}
            label={label}
            isOpen={openItem === key}
            onToggle={() => toggleItem(key)}
          >
            <TypographyScaleEditor
              value={getTypographyValue(key)}
              onChange={(value) => updateTypographyScale(key, value)}
            />
          </AccordionItem>
        ))}

        {/* Colors Accordion */}
        <AccordionItem
          label="Colors"
          isOpen={openItem === "colors"}
          onToggle={() => toggleItem("colors")}
        >
          <div className="flex flex-col gap-4">
            {COLOR_TOKENS.map(({ key, label }) => (
              <ColorField
                key={key}
                label={label}
                value={getColorValue(key)}
                onChange={(value) => updateColor(key, `#${value}`)}
              />
            ))}
          </div>
        </AccordionItem>
      </div>
    </div>
  );
}

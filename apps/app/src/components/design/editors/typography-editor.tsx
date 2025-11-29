"use client";

import * as React from "react";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { TypographyScaleEditor } from "../fields";
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

type TypographyScaleKey = (typeof TYPOGRAPHY_SCALES)[number]["key"];

// Simple accordion item component
interface AccordionItemProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionItem({
  label,
  isOpen,
  onToggle,
  children,
}: AccordionItemProps) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
      >
        <span className="type-p text-foreground">{label}</span>
        <Icons.ChevronDown
          className={cn(
            "h-4 w-4 text-secondary transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function TypographyEditor() {
  const { themeStylesDraft, updateTypographyScale } = useDesignEditor();
  const [openItem, setOpenItem] = React.useState<string | null>(null);

  const toggleItem = (key: string) => {
    setOpenItem((prev) => (prev === key ? null : key));
  };

  // Get current typography values with defaults
  const getTypographyValue = (scale: TypographyScaleKey): TypographyScale => {
    return themeStylesDraft.typography?.[scale] || {};
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
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
    </div>
  );
}


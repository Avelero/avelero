"use client";

import * as React from "react";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { Select } from "@v1/ui/select";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { FontSelect } from "@/components/select/font-select";
import { PixelInput } from "../inputs/pixel-input";
import { FieldWrapper } from "../inputs/field-wrapper";
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
  { key: "body-xs" as const, label: "Extra Small" },
] as const;

type TypographyScaleKey = (typeof TYPOGRAPHY_SCALES)[number]["key"];

// Select options for typography fields
const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "700", label: "Bold" },
];

const LINE_HEIGHT_OPTIONS = [
  { value: "1", label: "Tight" },
  { value: "1.25", label: "Normal" },
  { value: "1.5", label: "Relaxed" },
  { value: "2", label: "Double" },
];

const LETTER_SPACING_OPTIONS = [
  { value: "-0.025em", label: "Tight" },
  { value: "0em", label: "Normal" },
  { value: "0.025em", label: "Wide" },
];

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
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Typography scale form (inlined)
interface TypographyScaleFormProps {
  value: TypographyScale;
  onChange: (value: TypographyScale) => void;
}

function TypographyScaleForm({ value, onChange }: TypographyScaleFormProps) {
  const handleChange = <K extends keyof TypographyScale>(
    key: K,
    newValue: TypographyScale[K],
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  const fontSizeValue =
    typeof value.fontSize === "number"
      ? value.fontSize
      : Number.parseFloat(String(value.fontSize)) || 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Font Family */}
      <FieldWrapper label="Font">
        <FontSelect
          value={value.fontFamily || null}
          onValueChange={(v) => handleChange("fontFamily", v)}
          placeholder="Select font..."
          className="h-8 text-sm"
        />
      </FieldWrapper>

      {/* Size and Weight row */}
      <div className="grid grid-cols-2 gap-3">
        <PixelInput
          label="Size"
          value={fontSizeValue}
          onChange={(v) => handleChange("fontSize", v)}
          min={0}
          step={1}
          placeholder="px"
        />
        <FieldWrapper label="Weight">
          <Select
            value={String(value.fontWeight || "400")}
            onValueChange={(v) =>
              handleChange("fontWeight", Number.parseInt(v, 10))
            }
            options={FONT_WEIGHT_OPTIONS}
            placeholder="Select weight..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>

      {/* Line height and Tracking row */}
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Line height">
          <Select
            value={String(value.lineHeight || "1.25")}
            onValueChange={(v) =>
              handleChange("lineHeight", Number.parseFloat(v))
            }
            options={LINE_HEIGHT_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
        <FieldWrapper label="Tracking">
          <Select
            value={String(value.letterSpacing || "0em")}
            onValueChange={(v) => handleChange("letterSpacing", v)}
            options={LETTER_SPACING_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>
    </div>
  );
}

export function TypographyEditor() {
  const { themeStylesDraft, updateTypographyScale } = useDesignEditor();
  const [openItem, setOpenItem] = React.useState<string | null>(null);

  const toggleItem = (key: string) => {
    setOpenItem((prev) => (prev === key ? null : key));
  };

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
          <TypographyScaleForm
            value={getTypographyValue(key)}
            onChange={(value) => updateTypographyScale(key, value)}
          />
        </AccordionItem>
      ))}
    </div>
  );
}

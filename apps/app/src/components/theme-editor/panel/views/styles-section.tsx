"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import * as React from "react";
import {
  findComponentById,
  type StyleField,
  TYPESCALE_OPTIONS,
} from "../../registry";
import {
  ColorInput,
  parseHexWithAlpha,
  combineHexWithAlpha,
  PixelInput,
  RadiusInput,
  BorderInput,
  FieldWrapper,
  EditorSection,
} from "../inputs";

// =============================================================================
// INTERNAL SELECT COMPONENT
// =============================================================================

interface StyleSelectProps {
  options: { value: string; label: string }[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function StyleSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  className,
}: StyleSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
  };

  return (
    <Select open={open} onOpenChange={setOpen}>
      <SelectTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            "w-full justify-between data-[state=open]:bg-accent",
            className,
          )}
        >
          <span
            className={cn("truncate px-1", isPlaceholder && "text-tertiary")}
          >
            {displayValue}
          </span>
          <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
        </Button>
      </SelectTrigger>
      <SelectContent defaultValue={value ?? undefined}>
        <SelectList>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <span className="type-p">{option.label}</span>
                {value === option.value && <Icons.Check className="h-4 w-4" />}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectList>
      </SelectContent>
    </Select>
  );
}

// =============================================================================
// STYLE FIELD RENDERER
// =============================================================================

interface StyleFieldRendererProps {
  field: StyleField;
}

function StyleFieldRenderer({ field }: StyleFieldRendererProps) {
  const { getComponentStyleValue, updateComponentStyle } = useDesignEditor();

  // Values are always present in the DB (seeded on brand creation)
  const value = getComponentStyleValue(field.path);

  switch (field.type) {
    case "color": {
      // Parse the stored value to extract RGB and opacity
      // Supports 6-char (#RRGGBB) and 8-char (#RRGGBBAA) hex formats
      const hexValue = typeof value === "string" ? value : "";
      const { rgb, opacity } = parseHexWithAlpha(hexValue);

      return (
        <ColorInput
          label={field.label}
          value={rgb}
          opacity={opacity}
          onChange={(newRgb) => {
            // Combine new RGB with existing opacity
            updateComponentStyle(
              field.path,
              combineHexWithAlpha(newRgb, opacity),
            );
          }}
          onOpacityChange={(newOpacity) => {
            // Combine existing RGB with new opacity
            updateComponentStyle(
              field.path,
              combineHexWithAlpha(rgb, newOpacity),
            );
          }}
          showOpacity={true}
        />
      );
    }

    case "number": {
      return (
        <PixelInput
          label={field.label}
          value={typeof value === "number" ? value : 0}
          onChange={(num) => updateComponentStyle(field.path, num)}
          unit={field.unit}
          min={0}
        />
      );
    }

    case "radius": {
      // Handle both single value and object value (4 corners)
      const defaultRadius = {
        topLeft: 0,
        topRight: 0,
        bottomLeft: 0,
        bottomRight: 0,
      };
      let radiusValues = defaultRadius;

      if (typeof value === "number") {
        // Single value - apply to all corners
        radiusValues = {
          topLeft: value,
          topRight: value,
          bottomLeft: value,
          bottomRight: value,
        };
      } else if (value && typeof value === "object" && "topLeft" in value) {
        const v = value as {
          topLeft: number;
          topRight: number;
          bottomLeft: number;
          bottomRight: number;
        };
        radiusValues = {
          topLeft: v.topLeft ?? 0,
          topRight: v.topRight ?? 0,
          bottomLeft: v.bottomLeft ?? 0,
          bottomRight: v.bottomRight ?? 0,
        };
      }

      return (
        <RadiusInput
          label={field.label}
          values={radiusValues}
          onChange={(newValues) => updateComponentStyle(field.path, newValues)}
        />
      );
    }

    case "border": {
      // Handle both single value and object value (4 sides)
      const defaultBorder = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      };
      let borderValues = defaultBorder;

      if (typeof value === "number") {
        // Single value - apply to all sides
        borderValues = {
          top: value,
          right: value,
          bottom: value,
          left: value,
        };
      } else if (value && typeof value === "object" && "top" in value) {
        const v = value as {
          top: number;
          right: number;
          bottom: number;
          left: number;
        };
        borderValues = {
          top: v.top ?? 0,
          right: v.right ?? 0,
          bottom: v.bottom ?? 0,
          left: v.left ?? 0,
        };
      }

      return (
        <BorderInput
          label={field.label}
          values={borderValues}
          onChange={(newValues) => updateComponentStyle(field.path, newValues)}
        />
      );
    }

    case "typescale": {
      return (
        <FieldWrapper label={field.label}>
          <StyleSelect
            value={typeof value === "string" ? value : null}
            onValueChange={(val) => updateComponentStyle(field.path, val)}
            options={TYPESCALE_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );
    }

    case "select": {
      return (
        <FieldWrapper label={field.label}>
          <StyleSelect
            value={typeof value === "string" ? value : null}
            onValueChange={(val) => updateComponentStyle(field.path, val)}
            options={field.options || []}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      );
    }

    case "toggle":
      return null;

    default:
      return null;
  }
}

// =============================================================================
// GROUP FIELDS BY CATEGORY
// =============================================================================

type FieldCategory =
  | "background"
  | "stroke"
  | "typography"
  | "sizing"
  | "spacing"
  | "other";

interface GroupedFields {
  background: StyleField[];
  stroke: StyleField[];
  typography: StyleField[];
  sizing: StyleField[];
  spacing: StyleField[];
  other: StyleField[];
}

function categorizeField(field: StyleField): FieldCategory {
  const label = field.label.toLowerCase();
  const path = field.path.toLowerCase();

  if (label.includes("background") || path.includes("background")) {
    return "background";
  }

  if (
    field.type === "radius" ||
    field.type === "border" ||
    label.includes("border") ||
    label.includes("stroke") ||
    label.includes("radius") ||
    label.includes("rounding") ||
    path.includes("border") ||
    path.includes("radius")
  ) {
    return "stroke";
  }

  if (
    field.type === "typescale" ||
    label.includes("font") ||
    label.includes("weight") ||
    label.includes("transform") ||
    label.includes("capitalization") ||
    label.includes("typescale") ||
    label.includes("color") ||
    path.includes("font") ||
    path.includes("color") ||
    path.includes("typescale") ||
    path.includes("texttransform")
  ) {
    return "typography";
  }

  // Size fields (e.g., icon size, width, height)
  if (
    label.includes("size") ||
    label.includes("width") ||
    label.includes("height")
  ) {
    return "sizing";
  }

  // Spacing fields (padding, margin, gap)
  if (
    label.includes("padding") ||
    label.includes("margin") ||
    label.includes("gap") ||
    label.includes("spacing")
  ) {
    return "spacing";
  }

  return "other";
}

function organizeStyleFields(fields: StyleField[]): {
  mainGroups: GroupedFields;
  sectionGroups: Record<string, StyleField[]>;
  sectionOrder: string[];
} {
  const mainGroups: GroupedFields = {
    background: [],
    stroke: [],
    typography: [],
    sizing: [],
    spacing: [],
    other: [],
  };
  const sectionGroups: Record<string, StyleField[]> = {};
  const sectionOrder: string[] = [];

  for (const field of fields) {
    if (field.section) {
      const section = field.section;
      if (!sectionGroups[section]) {
        sectionGroups[section] = [];
        sectionOrder.push(section);
      }
      sectionGroups[section]?.push(field);
    } else {
      const category = categorizeField(field);
      mainGroups[category].push(field);
    }
  }

  return { mainGroups, sectionGroups, sectionOrder };
}

// =============================================================================
// STYLES SECTION (MAIN EXPORT)
// =============================================================================

interface StylesSectionProps {
  componentId: string;
}

export function StylesSection({ componentId }: StylesSectionProps) {
  const component = findComponentById(componentId);

  if (!component) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">Component not found</p>
      </div>
    );
  }

  const styleFields = component.styleFields || [];
  const { mainGroups, sectionGroups, sectionOrder } =
    organizeStyleFields(styleFields);

  if (styleFields.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">
          No style properties for this component
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      {/* Main field groups with section borders */}
      {mainGroups.background.length > 0 && (
        <EditorSection title="Background">
          {mainGroups.background.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {mainGroups.stroke.length > 0 && (
        <EditorSection title="Stroke">
          {mainGroups.stroke.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {mainGroups.typography.length > 0 && (
        <EditorSection title="Typography">
          {mainGroups.typography.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {mainGroups.sizing.length > 0 && (
        <EditorSection title="Sizing">
          {mainGroups.sizing.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {mainGroups.spacing.length > 0 && (
        <EditorSection title="Spacing">
          {mainGroups.spacing.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {mainGroups.other.length > 0 && (
        <EditorSection title="Other">
          {mainGroups.other.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </EditorSection>
      )}

      {/* Named section groups */}
      {sectionOrder.map((sectionName) => {
        const fields = sectionGroups[sectionName];
        if (!fields) return null;
        return (
          <EditorSection key={sectionName} title={sectionName}>
            {fields.map((field) => (
              <StyleFieldRenderer key={field.path} field={field} />
            ))}
          </EditorSection>
        );
      })}
    </div>
  );
}

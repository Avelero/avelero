"use client";

/**
 * Styles panel renderer for component-level style fields in the theme editor.
 */

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Switch } from "@v1/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import * as React from "react";
import { type StyleField, resolveComponentForEditor } from "../../registry";
import {
  AccordionItem,
  BorderInput,
  ColorInput,
  FieldWrapper,
  PixelInput,
  RadiusInput,
  combineHexWithAlpha,
  parseHexWithAlpha,
} from "../inputs";
import { TypographyStyleField } from "./typography-style-field";

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

function isToggleFieldChecked(value: unknown): boolean {
  // Interpret zero-width borders and empty strings as disabled toggle states.
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function StyleFieldRenderer({ field }: StyleFieldRendererProps) {
  const {
    getComponentStyleValue,
    getDefaultComponentStyleValue,
    updateComponentStyle,
  } = useDesignEditor();

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
          step={field.step}
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
      return <TypographyStyleField field={field} />;
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
      return (
        <FieldWrapper label={field.label} row>
          <Switch
            checked={isToggleFieldChecked(value)}
            onCheckedChange={(checked) => {
              // Restore the canonical default value when the toggle is turned back on.
              const defaultValue = getDefaultComponentStyleValue(field.path);
              updateComponentStyle(
                field.path,
                checked
                  ? field.enabledValue ?? defaultValue ?? true
                  : field.disabledValue,
              );
            }}
          />
        </FieldWrapper>
      );

    default:
      return null;
  }
}

// =============================================================================
// GROUP FIELDS BY SECTION
// =============================================================================

function organizeStyleFields(fields: StyleField[]): {
  sectionGroups: Record<string, StyleField[]>;
  sectionOrder: string[];
} {
  const sectionGroups: Record<string, StyleField[]> = {};
  const sectionOrder: string[] = [];

  for (const field of fields) {
    const section = field.section ?? "General";
    if (!sectionGroups[section]) {
      sectionGroups[section] = [];
      sectionOrder.push(section);
    }
    sectionGroups[section]?.push(field);
  }

  return { sectionGroups, sectionOrder };
}

/**
 * Split a style field path into its style key and property name.
 */
function splitStyleFieldPath(
  path: string,
): { styleKey: string; property: string } | null {
  const separatorIndex = path.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= path.length - 1) {
    return null;
  }

  return {
    styleKey: path.slice(0, separatorIndex),
    property: path.slice(separatorIndex + 1),
  };
}

/**
 * Hide standalone capitalization fields when the typography field owns them.
 */
function filterTypographyCompanionFields(fields: StyleField[]): StyleField[] {
  const typographyStyleKeys = new Set<string>();

  for (const field of fields) {
    if (field.type !== "typescale") continue;
    const pathParts = splitStyleFieldPath(field.path);
    if (!pathParts) continue;
    typographyStyleKeys.add(pathParts.styleKey);
  }

  return fields.filter((field) => {
    if (field.type !== "select") return true;

    const pathParts = splitStyleFieldPath(field.path);
    if (!pathParts) return true;

    return !(
      pathParts.property === "textTransform" &&
      typographyStyleKeys.has(pathParts.styleKey)
    );
  });
}

// =============================================================================
// STYLES SECTION (MAIN EXPORT)
// =============================================================================

interface StylesSectionProps {
  componentId: string;
}

export function StylesSection({ componentId }: StylesSectionProps) {
  const { passportDraft } = useDesignEditor();
  const component = resolveComponentForEditor(componentId, passportDraft);
  const styleFields = filterTypographyCompanionFields(
    component?.styleFields || [],
  );
  const [openSection, setOpenSection] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Start each component detail view with every accordion section collapsed.
    setOpenSection(null);
  }, [componentId]);

  if (!component) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">Component not found</p>
      </div>
    );
  }

  const { sectionGroups, sectionOrder } = organizeStyleFields(styleFields);

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
      {sectionOrder.map((sectionName) => {
        const fields = sectionGroups[sectionName];
        if (!fields) return null;
        return (
          <AccordionItem
            key={sectionName}
            label={sectionName}
            isOpen={openSection === sectionName}
            onToggle={() =>
              setOpenSection((prev) =>
                prev === sectionName ? null : sectionName,
              )
            }
          >
            <div className="flex flex-col gap-3">
              {fields.map((field) => (
                <StyleFieldRenderer key={field.path} field={field} />
              ))}
            </div>
          </AccordionItem>
        );
      })}
    </div>
  );
}

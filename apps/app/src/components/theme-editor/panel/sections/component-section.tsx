"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import {
  findComponentById,
  type StyleField,
} from "../../registry/component-registry";
import { ColorInput } from "../inputs/color-input";
import { PixelInput } from "../inputs/pixel-input";
import { RadiusInput } from "../inputs/radius-input";
import { FieldWrapper } from "../inputs/field-wrapper";
import { Select } from "@v1/ui/select";

// =============================================================================
// EDITOR SECTION
// =============================================================================

function EditorSection({
  title,
  children,
}: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border p-4">
      <span className="type-small font-medium text-primary mb-3 block">
        {title}
      </span>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Typescale options for style fields
const TYPESCALE_OPTIONS = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "body", label: "Body" },
  { value: "body-sm", label: "Small" },
  { value: "body-xs", label: "Extra Small" },
];

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
      const displayValue =
        typeof value === "string" ? value.replace("#", "") : "";
      return (
        <ColorInput
          label={field.label}
          value={displayValue}
          onChange={(hex) => updateComponentStyle(field.path, `#${hex}`)}
          showOpacity={true}
          opacity={100}
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

    case "typescale": {
      return (
        <FieldWrapper label={field.label}>
          <Select
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
          <Select
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
// COMPONENT SECTION (MAIN EXPORT)
// =============================================================================

interface ComponentSectionProps {
  componentId: string;
}

export function ComponentSection({ componentId }: ComponentSectionProps) {
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

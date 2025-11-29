"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import {
  findComponentById,
  type StyleField,
  type ConfigField,
} from "../layout/component-registry";
import { ColorField, NumberField, SelectField } from "../fields";
import { FontFamilySelect } from "../fields/font-family-select";

// =============================================================================
// FIELD GROUP COMPONENT
// =============================================================================

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
}

function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="type-small font-medium text-primary">{title}</span>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
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

  const value = getComponentStyleValue(field.path);

  switch (field.type) {
    case "color":
      return (
        <ColorField
          label={field.label}
          value={typeof value === "string" ? value.replace("#", "") : ""}
          onChange={(hex) => updateComponentStyle(field.path, `#${hex}`)}
          showOpacity={true}
          opacity={100}
        />
      );

    case "number":
      return (
        <NumberField
          label={field.label}
          value={typeof value === "number" ? value : 0}
          onChange={(num) => updateComponentStyle(field.path, num)}
          unit={field.unit}
          min={0}
        />
      );

    case "font-family":
      return (
        <div className="flex flex-col gap-1.5">
          <span className="type-small text-secondary">{field.label}</span>
          <FontFamilySelect
            value={typeof value === "string" ? value : ""}
            onValueChange={(font) => updateComponentStyle(field.path, font)}
          />
        </div>
      );

    case "select":
      return (
        <SelectField
          label={field.label}
          value={typeof value === "string" ? value : ""}
          onChange={(val) => updateComponentStyle(field.path, val)}
          options={field.options || []}
        />
      );

    case "four-sides":
      // TODO: Implement four-sides field
      return null;

    default:
      return null;
  }
}

// =============================================================================
// GROUP FIELDS BY CATEGORY
// =============================================================================

type FieldCategory = "background" | "stroke" | "typography" | "spacing" | "other";

interface GroupedFields {
  background: StyleField[];
  stroke: StyleField[];
  typography: StyleField[];
  spacing: StyleField[];
  other: StyleField[];
}

function categorizeField(field: StyleField): FieldCategory {
  const label = field.label.toLowerCase();
  const path = field.path.toLowerCase();

  // Background-related
  if (label.includes("background") || path.includes("background")) {
    return "background";
  }

  // Stroke/Border-related
  if (
    label.includes("border") ||
    label.includes("stroke") ||
    path.includes("border")
  ) {
    return "stroke";
  }

  // Typography-related
  if (
    field.type === "font-family" ||
    label.includes("font") ||
    label.includes("weight") ||
    label.includes("transform") ||
    label.includes("color") ||
    path.includes("font") ||
    path.includes("color")
  ) {
    return "typography";
  }

  // Spacing-related
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

function groupStyleFields(fields: StyleField[]): GroupedFields {
  const groups: GroupedFields = {
    background: [],
    stroke: [],
    typography: [],
    spacing: [],
    other: [],
  };

  for (const field of fields) {
    const category = categorizeField(field);
    groups[category].push(field);
  }

  return groups;
}

// =============================================================================
// COMPONENT EDITOR
// =============================================================================

interface ComponentEditorProps {
  componentId: string;
}

export function ComponentEditor({ componentId }: ComponentEditorProps) {
  const component = findComponentById(componentId);

  if (!component) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">Component not found</p>
      </div>
    );
  }

  const styleFields = component.styleFields || [];
  const configFields = component.configFields || [];
  const grouped = groupStyleFields(styleFields);

  const hasStyleFields = styleFields.length > 0;
  const hasConfigFields = configFields.length > 0;

  if (!hasStyleFields && !hasConfigFields) {
    return (
      <div className="p-4 text-center">
        <p className="type-small text-secondary">
          No editable properties for this component
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Background group */}
      {grouped.background.length > 0 && (
        <FieldGroup title="Background">
          {grouped.background.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </FieldGroup>
      )}

      {/* Stroke/Border group */}
      {grouped.stroke.length > 0 && (
        <FieldGroup title="Stroke">
          {grouped.stroke.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </FieldGroup>
      )}

      {/* Typography group */}
      {grouped.typography.length > 0 && (
        <FieldGroup title="Typography">
          {grouped.typography.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </FieldGroup>
      )}

      {/* Spacing group */}
      {grouped.spacing.length > 0 && (
        <FieldGroup title="Spacing">
          {grouped.spacing.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </FieldGroup>
      )}

      {/* Other fields */}
      {grouped.other.length > 0 && (
        <FieldGroup title="Other">
          {grouped.other.map((field) => (
            <StyleFieldRenderer key={field.path} field={field} />
          ))}
        </FieldGroup>
      )}

      {/* Config fields - TODO: implement config field renderers */}
      {hasConfigFields && (
        <FieldGroup title="Content">
          <p className="type-small text-secondary">
            Content fields coming soon
          </p>
        </FieldGroup>
      )}
    </div>
  );
}


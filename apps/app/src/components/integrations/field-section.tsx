"use client";

import { Icons } from "@v1/ui/icons";
import { Switch } from "@v1/ui/switch";

/**
 * Field section component for displaying grouped fields with toggles.
 * Used in both field-setup (initial configuration) and integration-detail (management).
 */

export interface FieldRowData {
  fieldKey: string;
  label: string;
  description: string;
  enabled: boolean;
  required?: boolean;
  /** Optional icon to show on the right (e.g., for mapping indicators) */
  rightIcon?: React.ReactNode;
}

interface FieldSectionProps {
  /** Section title (e.g., "Product", "Organization") */
  title: string;
  /** Fields to display in this section */
  fields: FieldRowData[];
  /** Called when a field toggle changes */
  onToggle?: (fieldKey: string, enabled: boolean) => void;
  /** Whether toggles are disabled (read-only mode) */
  disabled?: boolean;
}

/**
 * A section containing a group of field rows with toggles.
 */
export function FieldSection({
  title,
  fields,
  onToggle,
  disabled,
}: FieldSectionProps) {
  if (fields.length === 0) return null;

  return (
    <div className="border border-border">
      {/* Section header */}
      <div className="px-4 py-3 bg-background border-b border-border">
        <span className="type-p !font-medium text-foreground">{title}</span>
      </div>

      {/* Field rows */}
      <div>
        {fields.map((field) => (
          <FieldRow
            key={field.fieldKey}
            field={field}
            onToggle={onToggle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldRowProps {
  field: FieldRowData;
  onToggle?: (fieldKey: string, enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Single field row with toggle and description.
 */
function FieldRow({ field, onToggle, disabled }: FieldRowProps) {
  const isDisabled = disabled || field.required;

  return (
    <div className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0">
      <Switch
        checked={field.enabled}
        onCheckedChange={(checked) => onToggle?.(field.fieldKey, checked)}
        disabled={isDisabled}
      />
      <div className="flex-1 min-w-0">
        <span className="type-p text-foreground">{field.label}</span>
        <p className="type-small text-secondary">{field.description}</p>
      </div>
      {field.rightIcon}
    </div>
  );
}

/** Stable skeleton row IDs to avoid array index keys */
const SKELETON_ROW_IDS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/**
 * Loading skeleton for field sections.
 */
export function FieldSectionSkeleton({ rowCount = 4 }: { rowCount?: number }) {
  const rows = SKELETON_ROW_IDS.slice(0, rowCount);

  return (
    <div className="border border-border">
      <div className="px-4 py-3 bg-accent/30 border-b border-border">
        <div className="h-4 w-24 bg-accent animate-pulse" />
      </div>
      <div>
        {rows.map((id) => (
          <div
            key={id}
            className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0 animate-pulse"
          >
            <div className="h-5 w-9 bg-accent" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-32 bg-accent mb-1" />
              <div className="h-3 w-48 bg-accent" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


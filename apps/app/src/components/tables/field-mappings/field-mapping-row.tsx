"use client";

import { useUpdateFieldMappingMutation } from "@/hooks/use-integrations";
import { cn } from "@v1/ui/cn";
import { Select, type SelectOption } from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { toast } from "@v1/ui/sonner";
import type { FieldMappingRow as FieldMappingRowType, SourceOption } from "./types";

interface FieldMappingRowProps {
  mapping: FieldMappingRowType;
  brandIntegrationId: string;
  sourceOptions: SourceOption[];
}

/**
 * Get field display name from field key.
 */
function getFieldDisplayName(fieldKey: string): string {
  const parts = fieldKey.split(".");
  const fieldName = parts[parts.length - 1];
  if (!fieldName) return fieldKey;

  // Convert camelCase to Title Case
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Single field row with toggle and source selector.
 */
export function FieldMappingRow({
  mapping,
  brandIntegrationId,
  sourceOptions,
}: FieldMappingRowProps) {
  const updateMutation = useUpdateFieldMappingMutation();
  const isUpdating = updateMutation.status === "pending";

  async function handleToggle(enabled: boolean) {
    try {
      await updateMutation.mutateAsync({
        brand_integration_id: brandIntegrationId,
        field_key: mapping.fieldKey,
        ownership_enabled: enabled,
      });
    } catch (error) {
      toast.error("Failed to update field");
    }
  }

  async function handleSourceChange(sourceKey: string) {
    try {
      await updateMutation.mutateAsync({
        brand_integration_id: brandIntegrationId,
        field_key: mapping.fieldKey,
        source_option_key: sourceKey || null,
      });
    } catch (error) {
      toast.error("Failed to update field source");
    }
  }

  const isEnabled = mapping.ownershipEnabled;
  const selectedSource = mapping.sourceOptionKey ?? sourceOptions[0]?.value ?? "";

  // Convert to Select component format
  const selectOptions: SelectOption[] = sourceOptions.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <div
      className={cn(
        "px-4 py-3 flex items-center justify-between gap-4",
        "border-b border-border last:border-b-0",
        !isEnabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-foreground text-sm truncate">
            {getFieldDisplayName(mapping.fieldKey)}
          </span>
          <span className="text-tertiary text-xs font-mono truncate">
            {mapping.fieldKey}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectOptions.length > 1 ? (
          <Select
            value={selectedSource}
            onValueChange={handleSourceChange}
            options={selectOptions}
            placeholder="Select source"
            disabled={!isEnabled || isUpdating}
            className="w-[180px]"
          />
        ) : (
          <span className="text-secondary text-sm w-[180px] text-right">
            {selectOptions[0]?.label ?? "Default"}
          </span>
        )}
      </div>
    </div>
  );
}





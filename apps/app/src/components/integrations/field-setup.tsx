"use client";

import {
  useFieldMappingsQuery,
  useUpdateFieldMappingsBatchMutation,
} from "@/hooks/use-integrations";
import {
  FieldSection,
  type FieldRowData,
} from "@/components/integrations/field-section";
import {
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  HIDDEN_FIELDS,
  getFieldGroup,
  getFieldUIInfo,
  type FieldGroup,
} from "@/components/integrations/field-config";
import { getConnectorFields } from "@v1/integrations/ui";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import { useMemo, useState } from "react";

interface FieldSetupProps {
  brandIntegrationId: string;
  connectorSlug: string;
  integrationName: string;
  onCancel: () => void;
  onSetupComplete: () => void;
}

/**
 * Field setup wizard for configuring which fields an integration owns.
 * Shows all available fields with toggles to enable/disable ownership.
 */
export function FieldSetup({
  brandIntegrationId,
  connectorSlug,
  integrationName,
  onCancel,
  onSetupComplete,
}: FieldSetupProps) {
  // Get available fields from the connector schema
  const availableFields = useMemo(
    () => getConnectorFields(connectorSlug),
    [connectorSlug],
  );

  // Required fields that are always enabled
  const requiredFieldKeys = useMemo(
    () => new Set(availableFields.filter((f) => f.required).map((f) => f.fieldKey)),
    [availableFields],
  );

  // Initialize with all fields enabled by default
  const [enabledFields, setEnabledFields] = useState<Set<string>>(() =>
    new Set(availableFields.map((f) => f.fieldKey)),
  );

  const batchMutation = useUpdateFieldMappingsBatchMutation();
  const { refetch: refetchFieldMappings } = useFieldMappingsQuery(brandIntegrationId);
  const isSaving = batchMutation.status === "pending";

  function handleToggle(fieldKey: string, enabled: boolean) {
    // Don't allow toggling required fields
    if (requiredFieldKeys.has(fieldKey)) return;

    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(fieldKey);
        // If turning on price, also turn on currency
        if (fieldKey === "product.price") {
          next.add("product.currency");
        }
      } else {
        next.delete(fieldKey);
        // If turning off price, also turn off currency
        if (fieldKey === "product.price") {
          next.delete("product.currency");
        }
      }
      return next;
    });
  }

  async function handleSave() {
    try {
      // Build final field states:
      // - salesStatus is always enabled (hidden from UI)
      // - currency follows price state (handled by handleToggle)
      const finalEnabledFields = new Set(enabledFields);
      finalEnabledFields.add("product.salesStatus"); // Always on

      // Save all field configs - both enabled and disabled
      await batchMutation.mutateAsync({
        brand_integration_id: brandIntegrationId,
        fields: availableFields.map((field) => ({
          field_key: field.fieldKey,
          ownership_enabled: finalEnabledFields.has(field.fieldKey),
        })),
      });

      // Refetch to ensure the data is in cache before transitioning
      await refetchFieldMappings();

      toast.success("Field configuration saved");
      onSetupComplete();
    } catch (error) {
      toast.error("Failed to save field configuration");
    }
  }

  // Build grouped fields for display
  const groupedFields = useMemo(() => {
    const groups: Record<FieldGroup, FieldRowData[]> = {
      product: [],
      organization: [],
      sales: [],
    };

    const visibleFields = availableFields.filter((f) => !HIDDEN_FIELDS.has(f.fieldKey));

    for (const field of visibleFields) {
      const group = getFieldGroup(field.fieldKey);
      const uiInfo = getFieldUIInfo(field);

      groups[group].push({
        fieldKey: field.fieldKey,
        label: uiInfo.label,
        description: uiInfo.description,
        enabled: enabledFields.has(field.fieldKey),
        required: requiredFieldKeys.has(field.fieldKey),
      });
    }

    return groups;
  }, [availableFields, enabledFields, requiredFieldKeys]);

  return (
    <div className="space-y-6">
      {/* Configure fields header */}
      <div className="border border-border p-4">
        <div className="flex flex-col gap-2">
          <h6 className="text-base font-medium text-foreground">Configure fields</h6>
          <p className="text-sm text-secondary">
            Select which fields you would like {integrationName} to populate. If a field is already
            owned by another integration, ownership will be transferred to {integrationName}.
          </p>
        </div>
      </div>

      {/* Field groups */}
      {FIELD_GROUP_ORDER.map((groupKey) => {
        const fields = groupedFields[groupKey];
        if (fields.length === 0) return null;

        return (
          <FieldSection
            key={groupKey}
            title={FIELD_GROUP_LABELS[groupKey]}
            fields={fields}
            onToggle={handleToggle}
          />
        );
      })}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="brand" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}

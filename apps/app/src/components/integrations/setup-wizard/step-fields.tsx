"use client";

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
import { getConnectorFields } from "@v1/integrations";
import { Button } from "@v1/ui/button";
import { useMemo, useState } from "react";

interface StepFieldsProps {
  connectorSlug: string;
  integrationName: string;
  onComplete: (enabledFields: Set<string>) => void;
  onBack: () => void;
  isSaving: boolean;
}

/**
 * Step 3: Configure field ownership.
 * Shows all available fields with toggles to enable/disable ownership.
 */
export function StepFields({
  connectorSlug,
  integrationName,
  onComplete,
  onBack,
  isSaving,
}: StepFieldsProps) {
  // Get available fields from the connector schema
  const availableFields = useMemo(
    () => getConnectorFields(connectorSlug),
    [connectorSlug],
  );

  // Required fields that are always enabled
  const requiredFieldKeys = useMemo(
    () =>
      new Set(availableFields.filter((f) => f.required).map((f) => f.fieldKey)),
    [availableFields],
  );

  // Initialize with all fields enabled by default
  const [enabledFields, setEnabledFields] = useState<Set<string>>(
    () => new Set(availableFields.map((f) => f.fieldKey)),
  );

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

  function handleComplete() {
    // Build final field states:
    // - salesStatus is always enabled (hidden from UI)
    // - currency follows price state (handled by handleToggle)
    const finalEnabledFields = new Set(enabledFields);
    finalEnabledFields.add("product.salesStatus"); // Always on
    onComplete(finalEnabledFields);
  }

  // Build grouped fields for display
  const groupedFields = useMemo(() => {
    const groups: Record<FieldGroup, FieldRowData[]> = {
      product: [],
      variants: [],
      organization: [],
      sales: [],
    };

    const visibleFields = availableFields.filter(
      (f) => !HIDDEN_FIELDS.has(f.fieldKey),
    );

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
      {/* Header section */}
      <div className="space-y-2">
        <h5 className="type-h5 text-foreground">Configure fields</h5>
        <p className="type-p text-secondary">
          Select which fields you would like {integrationName} to populate. If a
          field is already owned by another integration, ownership will be
          transferred to {integrationName}.
        </p>
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
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Back
        </Button>
        <Button variant="brand" onClick={handleComplete} disabled={isSaving}>
          {isSaving ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
}

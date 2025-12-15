"use client";

import {
  useFieldMappingsQuery,
  useUpdateFieldMappingsBatchMutation,
} from "@/hooks/use-integrations";
import {
  getConnectorFields,
  FIELD_CATEGORY_LABELS,
  type ConnectorFieldMeta,
} from "@v1/integrations/ui";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Switch } from "@v1/ui/switch";
import { toast } from "@v1/ui/sonner";
import { useMemo, useState } from "react";

interface FieldSetupProps {
  brandIntegrationId: string;
  connectorSlug: string;
  integrationName: string;
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

  function toggleField(fieldKey: string) {
    // Don't allow toggling required fields
    if (requiredFieldKeys.has(fieldKey)) return;

    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  }

  function enableAll() {
    setEnabledFields(new Set(availableFields.map((f) => f.fieldKey)));
  }

  function disableAll() {
    // Keep required fields enabled
    setEnabledFields(new Set(requiredFieldKeys));
  }

  async function handleSave() {
    try {
      // Save all field configs - both enabled and disabled
      await batchMutation.mutateAsync({
        brand_integration_id: brandIntegrationId,
        fields: availableFields.map((field) => ({
          field_key: field.fieldKey,
          ownership_enabled: enabledFields.has(field.fieldKey),
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

  // Filter out required fields (they sync automatically, no need to show)
  // and group remaining fields by entity
  const optionalFields = availableFields.filter((f) => !f.required);
  const productFields = optionalFields.filter((f) => f.entity === "product");
  const variantFields = optionalFields.filter((f) => f.entity === "variant");

  // Count only optional fields for display
  const enabledOptionalCount = optionalFields.filter((f) => enabledFields.has(f.fieldKey)).length;
  const totalOptionalCount = optionalFields.length;

  return (
    <div className="space-y-6">
      {/* Intro section */}
      <div className="border border-border">
        <div className="p-6 border-b border-border bg-accent/30">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand/10 text-brand">
              <Icons.Settings className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h5 className="text-foreground font-medium">Configure Field Ownership</h5>
              <p className="text-secondary text-sm mt-1">
                Select which fields {integrationName} should manage. When a field is enabled,
                {integrationName} will update it during each sync. Disabled fields will preserve
                your manual changes.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">
              {enabledOptionalCount} of {totalOptionalCount} fields enabled
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={enableAll}
                className="text-secondary hover:text-foreground transition-colors"
              >
                Enable all
              </button>
              <span className="text-tertiary">·</span>
              <button
                type="button"
                onClick={disableAll}
                className="text-secondary hover:text-foreground transition-colors"
              >
                Disable all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product fields */}
      <div className="border border-border">
        <div className="px-4 py-3 bg-accent/30 border-b border-border">
          <div className="flex items-center gap-2">
            <Icons.Package className="h-4 w-4 text-secondary" />
            <span className="text-foreground font-medium text-sm">
              {FIELD_CATEGORY_LABELS.product}
            </span>
            <span className="text-secondary text-xs">
              ({productFields.filter((f) => enabledFields.has(f.fieldKey)).length}/
              {productFields.length} enabled)
            </span>
          </div>
        </div>
        <div>
          {productFields.map((field) => (
            <FieldSetupRow
              key={field.fieldKey}
              label={field.label}
              description={field.description}
              enabled={enabledFields.has(field.fieldKey)}
              onToggle={() => toggleField(field.fieldKey)}
            />
          ))}
        </div>
      </div>

      {/* Variant fields */}
      <div className="border border-border">
        <div className="px-4 py-3 bg-accent/30 border-b border-border">
          <div className="flex items-center gap-2">
            <Icons.Layers className="h-4 w-4 text-secondary" />
            <span className="text-foreground font-medium text-sm">
              {FIELD_CATEGORY_LABELS.variant}
            </span>
            <span className="text-secondary text-xs">
              ({variantFields.filter((f) => enabledFields.has(f.fieldKey)).length}/
              {variantFields.length} enabled)
            </span>
          </div>
        </div>
        <div>
          {variantFields.map((field) => (
            <FieldSetupRow
              key={field.fieldKey}
              label={field.label}
              description={field.description}
              enabled={enabledFields.has(field.fieldKey)}
              onToggle={() => toggleField(field.fieldKey)}
            />
          ))}
        </div>
      </div>

      {/* Warning notice */}
      <div className="border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Icons.AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-800 text-sm font-medium">Important</p>
            <p className="text-amber-700 text-sm mt-1">
              Enabled fields will be overwritten by {integrationName} data during each sync.
              If you have existing product data you want to preserve (like descriptions),
              disable those fields.
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button variant="default" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save & Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Single field row in the setup wizard.
 */
function FieldSetupRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0">
      <Switch checked={enabled} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <span className="text-foreground text-sm">{label}</span>
        <p className="text-tertiary text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}



"use client";

import { useFieldMappingsQuery } from "@/hooks/use-integrations";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useEffect, useMemo, useState } from "react";
import { FieldMappingRow } from "./field-mapping-row";
import type { FieldMappingRow as FieldMappingRowType, SourceOption } from "./types";

interface FieldMappingTableProps {
  brandIntegrationId: string;
  connectorSlug: string;
}

/**
 * Categorize fields by their entity type.
 */
function categorizeFields(
  fields: FieldMappingRowType[],
): Record<string, FieldMappingRowType[]> {
  const categories: Record<string, FieldMappingRowType[]> = {};

  for (const field of fields) {
    const [entity] = field.fieldKey.split(".");
    const categoryName = getCategoryLabel(entity ?? "other");

    if (!categories[categoryName]) {
      categories[categoryName] = [];
    }
    categories[categoryName].push(field);
  }

  return categories;
}

/**
 * Get human-readable category label.
 */
function getCategoryLabel(entity: string): string {
  const labels: Record<string, string> = {
    product: "Product Fields",
    variant: "Variant Fields",
    environment: "Environmental Impact",
    season: "Season Fields",
    material: "Material Fields",
    facility: "Facility Fields",
    manufacturer: "Manufacturer Fields",
    color: "Color Fields",
    size: "Size Fields",
    tag: "Tag Fields",
    ecoClaim: "Eco Claim Fields",
  };
  return labels[entity] ?? `${entity.charAt(0).toUpperCase()}${entity.slice(1)} Fields`;
}

/**
 * Loading skeleton for field mapping table.
 */
function FieldMappingSkeleton() {
  return (
    <div className="border border-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0 animate-pulse"
        >
          <div className="h-5 w-9 bg-accent" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-4 w-32 bg-accent" />
            <div className="h-3 w-24 bg-accent" />
          </div>
          <div className="h-9 w-[180px] bg-accent" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table for configuring field mappings.
 */
export function FieldMappingTable({
  brandIntegrationId,
  connectorSlug,
}: FieldMappingTableProps) {
  const { data, isLoading } = useFieldMappingsQuery(brandIntegrationId);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Product Fields", "Variant Fields"]),
  );
  
  // Prevent hydration mismatch: always render skeleton on initial mount
  // because React Query's isLoading state differs between server and client
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const fields = (data?.data ?? []) as FieldMappingRowType[];

  // Build source options map (in real implementation, this would come from connector schema)
  const sourceOptionsMap = useMemo(() => {
    const map: Record<string, SourceOption[]> = {};
    for (const field of fields) {
      // For now, create options from the field's available sources
      // In production, this would come from the connector schema
      map[field.fieldKey] = [{ value: "default", label: "Default" }];
    }
    return map;
  }, [fields]);

  const categorizedFields = useMemo(() => categorizeFields(fields), [fields]);
  const categories = Object.keys(categorizedFields).sort();

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  // Show skeleton until mounted and data is loaded to prevent hydration mismatch
  if (!hasMounted || isLoading) {
    return <FieldMappingSkeleton />;
  }

  if (fields.length === 0) {
    return (
      <div className="border border-dashed border-border p-8 flex flex-col items-center justify-center gap-2 text-center">
        <Icons.Settings className="h-8 w-8 text-secondary" />
        <p className="text-secondary text-sm">No field mappings available</p>
        <p className="text-tertiary text-xs">
          Field mappings will appear after the first sync.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border divide-y divide-border">
      {categories.map((category) => {
        const categoryFields = categorizedFields[category] ?? [];
        const isExpanded = expandedCategories.has(category);
        const enabledCount = categoryFields.filter((f) => f.ownershipEnabled).length;

        return (
          <div key={category}>
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 flex items-center justify-between bg-accent/30 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icons.ChevronDown
                  className={cn(
                    "h-4 w-4 text-secondary transition-transform",
                    !isExpanded && "-rotate-90",
                  )}
                />
                <span className="text-foreground font-medium text-sm">{category}</span>
                <span className="text-secondary text-xs">
                  ({enabledCount}/{categoryFields.length} enabled)
                </span>
              </div>
            </button>

            {/* Category fields */}
            {isExpanded && (
              <div>
                {categoryFields.map((field) => (
                  <FieldMappingRow
                    key={field.fieldKey}
                    mapping={field}
                    brandIntegrationId={brandIntegrationId}
                    sourceOptions={sourceOptionsMap[field.fieldKey] ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Header with search and bulk actions for field mappings.
 */
export function FieldMappingHeader({
  totalFields,
  enabledFields,
  onEnableAll,
  onDisableAll,
}: {
  totalFields: number;
  enabledFields: number;
  onEnableAll?: () => void;
  onDisableAll?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex flex-col gap-0.5">
        <h6 className="text-foreground font-medium">Field Mappings</h6>
        <p className="text-secondary text-sm">
          {enabledFields} of {totalFields} fields enabled
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEnableAll}
          className="text-sm text-secondary hover:text-foreground transition-colors"
        >
          Enable all
        </button>
        <span className="text-tertiary">·</span>
        <button
          type="button"
          onClick={onDisableAll}
          className="text-sm text-secondary hover:text-foreground transition-colors"
        >
          Disable all
        </button>
      </div>
    </div>
  );
}

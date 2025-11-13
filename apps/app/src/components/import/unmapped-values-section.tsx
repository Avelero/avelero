"use client";

import {
  generatePendingEntityKey,
  usePendingEntities,
} from "@/contexts/pending-entities-context";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { EntityValueCombobox } from "./entity-value-combobox";

//===================================================================================
// TYPES
//===================================================================================

type EntityType =
  | "MATERIAL"
  | "COLOR"
  | "SIZE"
  | "SEASON"
  | "TAG"
  | "ECO_CLAIM"
  | "FACILITY"
  | "SHOWCASE_BRAND"
  | "CERTIFICATION"
  | "CATEGORY";

interface UnmappedValue {
  rawValue: string;
  sourceColumn: string;
  affectedRows: number;
  isDefined: boolean;
}

interface UnmappedValueGroup {
  entityType: EntityType;
  values: UnmappedValue[];
}

interface UnmappedValuesResponse {
  unmappedValues: UnmappedValueGroup[];
  totalUnmapped: number;
  totalDefined: number;
}

interface UnmappedValuesSectionProps {
  jobId: string;
  onAllValuesDefined?: (allDefined: boolean) => void;
}

//===================================================================================
// HELPER FUNCTIONS
//===================================================================================

/**
 * Get human-readable entity type name
 */
function getEntityTypeName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    MATERIAL: "Materials",
    COLOR: "Colors",
    SIZE: "Sizes",
    SEASON: "Seasons",
    TAG: "Tags",
    ECO_CLAIM: "Eco Claims",
    FACILITY: "Facilities",
    SHOWCASE_BRAND: "Showcase Brands",
    CERTIFICATION: "Certifications",
    CATEGORY: "Categories",
  };
  return names[entityType];
}

/**
 * Get entity type icon
 */
function getEntityIcon(entityType: EntityType) {
  const icons: Record<EntityType, React.ReactNode> = {
    MATERIAL: <Icons.Shirt className="h-4 w-4" />,
    COLOR: <Icons.Palette className="h-4 w-4" />,
    SIZE: <Icons.Ruler className="h-4 w-4" />,
    SEASON: <Icons.Calendar className="h-4 w-4" />,
    TAG: <Icons.Plus className="h-4 w-4" />,
    ECO_CLAIM: <Icons.Leaf className="h-4 w-4" />,
    FACILITY: <Icons.Building className="h-4 w-4" />,
    SHOWCASE_BRAND: <Icons.Store className="h-4 w-4" />,
    CERTIFICATION: <Icons.Award className="h-4 w-4" />,
    CATEGORY: <Icons.Package className="h-4 w-4" />,
  };
  return icons[entityType];
}

/**
 * Check if entity type should auto-create (simple entities)
 */
function isAutoCreatedEntity(entityType: EntityType): boolean {
  return entityType === "ECO_CLAIM";
}

//===================================================================================
// COMPONENT
//===================================================================================

export function UnmappedValuesSection({
  jobId,
  onAllValuesDefined,
}: UnmappedValuesSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { hasPendingEntity } = usePendingEntities();

  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = React.useState<Set<EntityType>>(
    new Set(),
  );

  // Fetch unmapped values
  const {
    data: response,
    isLoading,
    error,
  } = useQuery(trpc.bulk.values.unmapped.queryOptions({ jobId }));

  const unmappedData = response as UnmappedValuesResponse | undefined;
  const unmappedGroups = unmappedData?.unmappedValues ?? [];
  const totalUnmapped = unmappedData?.totalUnmapped ?? 0;

  // Prefetch all catalog data in a SINGLE optimized query
  // This replaces 5-6 individual queries with one efficient call
  // Load in parallel with unmapped values for maximum speed
  const {
    data: catalogData,
    isLoading: catalogLoading,
    error: catalogError,
  } = useQuery({
    ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
    enabled: !!jobId && !isLoading, // Only load after unmapped values load
    staleTime: 60000, // Cache for 60 seconds
    retry: 3, // Retry failed requests
  });

  // Pre-populate React Query cache with the catalog data
  // This ensures EntityValueCombobox components get instant data
  // Note: The brand routers use createListResponse which wraps data in {data: [...]}
  React.useEffect(() => {
    if (!catalogData) return;

    // Populate colors cache
    if (catalogData.colors.length > 0) {
      queryClient.setQueryData(trpc.brand.colors.list.queryKey(undefined), {
        data: catalogData.colors,
      });
    }

    // Populate materials cache
    if (catalogData.materials.length > 0) {
      queryClient.setQueryData(trpc.brand.materials.list.queryKey({}), {
        data: catalogData.materials,
      });
    }

    // Populate sizes cache
    if (catalogData.sizes.length > 0) {
      queryClient.setQueryData(trpc.brand.sizes.list.queryKey({}), {
        data: catalogData.sizes,
      });
    }

    // Populate facilities cache
    if (catalogData.facilities.length > 0) {
      queryClient.setQueryData(trpc.brand.facilities.list.queryKey({}), {
        data: catalogData.facilities,
      });
    }

    // Populate showcase brands cache
    if (catalogData.showcaseBrands.length > 0) {
      queryClient.setQueryData(trpc.brand.showcaseBrands.list.queryKey({}), {
        data: catalogData.showcaseBrands,
      });
    }
  }, [catalogData, queryClient, trpc]);

  // Expand all groups by default on first load
  React.useEffect(() => {
    if (unmappedGroups.length > 0 && expandedGroups.size === 0) {
      const allGroups = new Set(unmappedGroups.map((g) => g.entityType));
      setExpandedGroups(allGroups);
    }
  }, [unmappedGroups, expandedGroups.size]);

  // Check if all values are defined (either mapped or pending creation)
  React.useEffect(() => {
    if (!onAllValuesDefined) return;

    const allDefined = unmappedGroups.every((group) =>
      group.values.every((value) => {
        // Check if value has pending entity data for batch creation
        const key = generatePendingEntityKey(group.entityType, value.rawValue);
        return hasPendingEntity(key);
      }),
    );

    onAllValuesDefined(allDefined || totalUnmapped === 0);
  }, [unmappedGroups, hasPendingEntity, onAllValuesDefined, totalUnmapped]);

  /**
   * Toggle group expansion
   */
  const toggleGroup = (entityType: EntityType) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(entityType)) {
      newExpanded.delete(entityType);
    } else {
      newExpanded.add(entityType);
    }
    setExpandedGroups(newExpanded);
  };

  /**
   * Get count of defined values in a group
   */
  const getGroupDefinedCount = (group: UnmappedValueGroup) => {
    return group.values.filter((value) => {
      const key = generatePendingEntityKey(group.entityType, value.rawValue);
      return hasPendingEntity(key);
    }).length;
  };

  // Loading state - show partial UI as soon as unmapped values load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-6 w-6 animate-spin text-brand" />
        <span className="ml-3 text-sm text-secondary">
          Loading unmapped values...
        </span>
      </div>
    );
  }

  // Error state for unmapped values
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <Icons.AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-destructive">
              Failed to load unmapped values
            </p>
            <p className="text-xs text-destructive/80">
              {error instanceof Error
                ? error.message
                : "Please try again or contact support if the issue persists."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show catalog error as a banner but continue rendering
  // This allows users to see unmapped values even if catalog fails
  const catalogErrorBanner = catalogError ? (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4">
      <div className="flex items-center gap-2">
        <Icons.AlertTriangle className="h-4 w-4 text-amber-700" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Catalog data unavailable
          </p>
          <p className="text-xs text-amber-700">
            {catalogError instanceof Error
              ? catalogError.message
              : "Unable to load existing colors, sizes, etc. You can still define new values."}
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // All values defined - success state
  if (totalUnmapped === 0) {
    return (
      <div className="border border-border bg-background p-4 rounded">
        <div className="flex items-start gap-2">
          <Icons.CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="type-p text-primary font-medium">
              All values defined
            </p>
            <p className="type-small text-secondary mt-0.5">
              All catalog values have been created. You can now approve the
              import.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Separate auto-created entities from those needing user input
  const autoCreatedGroups = unmappedGroups.filter((g) =>
    isAutoCreatedEntity(g.entityType),
  );
  const userDefinedGroups = unmappedGroups.filter(
    (g) => !isAutoCreatedEntity(g.entityType),
  );

  const autoCreatedCount = autoCreatedGroups.reduce(
    (sum, group) => sum + group.values.length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Catalog error banner */}
      {catalogErrorBanner}

      {/* Auto-created notice */}
      {autoCreatedCount > 0 && (
        <div className="border border-border bg-background p-3 rounded">
          <div className="flex items-start gap-2">
            <Icons.CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="type-small text-primary">
                {autoCreatedCount} {autoCreatedCount === 1 ? "value" : "values"}{" "}
                auto-created
              </p>
              <p className="type-small text-secondary mt-0.5">
                {autoCreatedGroups.map((group, idx) => (
                  <span key={group.entityType}>
                    {getEntityTypeName(group.entityType)}:{" "}
                    {group.values.map((v) => v.rawValue).join(", ")}
                    {idx < autoCreatedGroups.length - 1 && " • "}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Entity groups */}
      {userDefinedGroups.length > 0 && (
        <div className="space-y-3">
          {userDefinedGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.entityType);
            const definedCount = getGroupDefinedCount(group);
            const allDefined = definedCount === group.values.length;
            const totalRows = group.values.reduce(
              (sum, v) => sum + v.affectedRows,
              0,
            );

            return (
              <div
                key={group.entityType}
                className="border border-border bg-background"
              >
                {/* Header */}
                <div className="bg-accent-light border-b border-border px-4 py-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.entityType)}
                    className="flex items-center gap-2 hover:text-brand transition-colors"
                  >
                    {getEntityIcon(group.entityType)}
                    <span className="type-small font-medium text-primary">
                      {getEntityTypeName(group.entityType)}
                    </span>
                    <span className="type-small text-secondary">
                      ({group.values.length}{" "}
                      {group.values.length === 1 ? "value" : "values"} •{" "}
                      {totalRows} rows)
                    </span>
                    {definedCount > 0 && (
                      <span className="type-small text-green-600 font-medium">
                        • {definedCount} defined
                      </span>
                    )}
                    <Icons.ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-secondary transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Group completion indicator */}
                  {allDefined && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <Icons.CheckCircle2 className="h-4 w-4" />
                      <span className="type-small font-medium">Complete</span>
                    </div>
                  )}
                </div>

                {/* Values list */}
                {isExpanded && (
                  <div className="divide-y divide-border">
                    {group.values.map((value, idx) => {
                      const key = generatePendingEntityKey(
                        group.entityType,
                        value.rawValue,
                      );
                      const isDefined = hasPendingEntity(key);

                      return (
                        <div
                          key={`${value.rawValue}-${idx}`}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors",
                            isDefined && "bg-green-50/50",
                          )}
                        >
                          {/* Defined indicator */}
                          <div className="flex-shrink-0">
                            {isDefined ? (
                              <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-border" />
                            )}
                          </div>

                          {/* Value name and info */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "type-p font-medium truncate",
                                isDefined ? "text-green-700" : "text-primary",
                              )}
                            >
                              {value.rawValue}
                            </p>
                            <p className="type-small text-tertiary">
                              {value.affectedRows}{" "}
                              {value.affectedRows === 1 ? "row" : "rows"}
                            </p>
                          </div>

                          {/* Mapping control */}
                          <div
                            className="w-full max-w-[280px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EntityValueCombobox
                              entityType={group.entityType}
                              rawValue={value.rawValue}
                              sourceColumn={value.sourceColumn}
                              jobId={jobId}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

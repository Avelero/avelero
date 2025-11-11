"use client";

import { MaterialSheet } from "@/components/sheets/material-sheet";
import { OperatorSheet } from "@/components/sheets/operator-sheet";
import { ShowcaseBrandSheet } from "@/components/sheets/showcase-brand-sheet";
import { ColorSheet } from "@/components/sheets/color-sheet";
import { SizeModal } from "@/components/modals/size-modal";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import * as React from "react";
import { toast } from "sonner";
import { EntityValueCombobox } from "./entity-value-combobox";
import {
  UnmappedBatchProgressModal,
  type BatchItemResult,
} from "./unmapped-batch-progress-modal";

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

/**
 * Check if entity type can be batch created
 * Only simple entities that don't require complex forms
 */
function canBatchCreate(entityType: EntityType): boolean {
  return entityType === "COLOR" || entityType === "MATERIAL";
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

  // Batch selection state - Map<entityType, Set<rawValue>>
  const [selectedValues, setSelectedValues] = React.useState<
    Map<EntityType, Set<string>>
  >(new Map());

  // Mutations for batch create
  const createColorMutation = useMutation(
    trpc.brand.colors.create.mutationOptions(),
  );
  const createMaterialMutation = useMutation(
    trpc.brand.materials.create.mutationOptions(),
  );
  const defineValueMutation = useMutation(
    trpc.bulk.values.define.mutationOptions(),
  );

  // Batch progress state
  const [batchProcessing, setBatchProcessing] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState({
    entityType: "",
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    results: [] as BatchItemResult[],
  });

  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = React.useState<Set<EntityType>>(
    new Set(),
  );

  // Fetch unmapped values
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery(trpc.bulk.values.unmapped.queryOptions({ jobId }));

  const unmappedData = response as UnmappedValuesResponse | undefined;
  const unmappedGroups = unmappedData?.unmappedValues ?? [];
  const totalUnmapped = unmappedData?.totalUnmapped ?? 0;

  // Prefetch all catalog data in a SINGLE optimized query
  // This replaces 5-6 individual queries with one efficient call
  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
    enabled: !isLoading && unmappedGroups.length > 0,
    staleTime: 60000, // Cache for 60 seconds
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

  // Notify parent when all values are defined
  React.useEffect(() => {
    if (onAllValuesDefined) {
      onAllValuesDefined(totalUnmapped === 0);
    }
  }, [totalUnmapped, onAllValuesDefined]);

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
   * Toggle value selection
   */
  const toggleValueSelection = (entityType: EntityType, rawValue: string) => {
    const newSelected = new Map(selectedValues);
    const typeSet = newSelected.get(entityType) || new Set();

    if (typeSet.has(rawValue)) {
      typeSet.delete(rawValue);
    } else {
      typeSet.add(rawValue);
    }

    if (typeSet.size === 0) {
      newSelected.delete(entityType);
    } else {
      newSelected.set(entityType, typeSet);
    }

    setSelectedValues(newSelected);
  };

  /**
   * Toggle all values in a group
   */
  const toggleGroupSelection = (group: UnmappedValueGroup) => {
    const newSelected = new Map(selectedValues);
    const typeSet = newSelected.get(group.entityType) || new Set();
    const allValuesSelected = group.values.every((v) =>
      typeSet.has(v.rawValue),
    );

    if (allValuesSelected) {
      // Deselect all
      newSelected.delete(group.entityType);
    } else {
      // Select all
      const allValues = new Set(group.values.map((v) => v.rawValue));
      newSelected.set(group.entityType, allValues);
    }

    setSelectedValues(newSelected);
  };

  /**
   * Check if value is selected
   */
  const isValueSelected = (entityType: EntityType, rawValue: string) => {
    return selectedValues.get(entityType)?.has(rawValue) || false;
  };

  /**
   * Get selected count for a group
   */
  const getGroupSelectedCount = (entityType: EntityType) => {
    return selectedValues.get(entityType)?.size || 0;
  };

  /**
   * Handle batch create for selected values
   */
  const handleBatchCreate = async (group: UnmappedValueGroup) => {
    const selected = selectedValues.get(group.entityType);
    if (!selected || selected.size === 0) {
      toast.error("No values selected");
      return;
    }

    const valuesToCreate = group.values.filter((v) => selected.has(v.rawValue));

    setBatchProcessing(true);
    setBatchProgress({
      entityType: getEntityTypeName(group.entityType),
      total: valuesToCreate.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    // Process each value sequentially
    for (const value of valuesToCreate) {
      try {
        let entityId: string | undefined;
        let entityName: string = value.rawValue;

        // Create entity based on type with default values
        switch (group.entityType) {
          case "COLOR": {
            // Create color with a default gray hex (#808080)
            const colorResult = await createColorMutation.mutateAsync({
              name: value.rawValue,
              hex: "808080", // Default gray
            });
            entityId = colorResult?.data?.id;
            break;
          }
          case "MATERIAL": {
            // Create material with basic data
            const materialResult = await createMaterialMutation.mutateAsync({
              name: value.rawValue,
              countryOfOrigin: null,
              recyclability: false,
            });
            entityId = materialResult?.data?.id;
            break;
          }
          default:
            throw new Error(
              `Batch create not supported for ${group.entityType}`,
            );
        }

        // Map the created entity to the CSV value
        if (entityId) {
          await defineValueMutation.mutateAsync({
            jobId,
            entityType: group.entityType,
            rawValue: value.rawValue,
            sourceColumn: value.sourceColumn,
            entityData: { name: entityName },
          });
        }

        setBatchProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
          succeeded: prev.succeeded + 1,
          results: [
            ...prev.results,
            { rawValue: value.rawValue, success: true },
          ],
        }));
      } catch (error) {
        console.error(`Failed to create ${value.rawValue}:`, error);
        setBatchProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
          failed: prev.failed + 1,
          results: [
            ...prev.results,
            {
              rawValue: value.rawValue,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          ],
        }));
      }
    }

    // Refetch unmapped values
    await refetch();

    // Clear selection for this group
    const newSelected = new Map(selectedValues);
    newSelected.delete(group.entityType);
    setSelectedValues(newSelected);
  };

  /**
   * Close batch progress modal
   */
  const closeBatchProgress = () => {
    setBatchProcessing(false);
    setBatchProgress({
      entityType: "",
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });
  };

  // Loading state
  if (isLoading || catalogLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-6 w-6 animate-spin text-brand" />
        <span className="ml-3 text-sm text-secondary">
          {isLoading ? "Loading unmapped values..." : "Loading catalog data..."}
        </span>
      </div>
    );
  }

  // Error state
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
              Please try again or contact support if the issue persists.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
    <TooltipProvider>
      <div className="space-y-4">
        {/* Info banner */}
        <div className="border border-border bg-accent-light p-3 rounded">
          <div className="flex items-start gap-2">
            <Icons.AlertCircle className="h-4 w-4 text-brand mt-0.5 flex-shrink-0" />
            <div>
              <p className="type-small text-primary font-medium">
                {totalUnmapped}{" "}
                {totalUnmapped === 1 ? "value needs" : "values need"} definition
              </p>
              <p className="type-small text-secondary mt-0.5">
                Map to existing entities or create new ones to proceed with
                import
              </p>
            </div>
          </div>
        </div>

        {/* Auto-created notice */}
        {autoCreatedCount > 0 && (
          <div className="border border-border bg-background p-3 rounded">
            <div className="flex items-start gap-2">
              <Icons.CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="type-small text-primary">
                  {autoCreatedCount}{" "}
                  {autoCreatedCount === 1 ? "value" : "values"} auto-created
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

        {/* Batch creation tip */}
        {userDefinedGroups.some((g) => canBatchCreate(g.entityType)) && (
          <div className="border border-brand/20 bg-brand/5 p-3 rounded">
            <div className="flex items-start gap-2">
              <Icons.Info className="h-4 w-4 text-brand mt-0.5 flex-shrink-0" />
              <div>
                <p className="type-small text-primary font-medium">
                  Batch creation available
                </p>
                <p className="type-small text-secondary mt-0.5">
                  Select multiple colors or materials to create them all at once
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
              const selectedCount = getGroupSelectedCount(group.entityType);
              const allSelected = selectedCount === group.values.length;
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
                    <div className="flex items-center gap-2">
                      {canBatchCreate(group.entityType) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={() =>
                                  toggleGroupSelection(group)
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Select all</TooltipContent>
                        </Tooltip>
                      )}
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
                        <Icons.ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-secondary transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    </div>

                    {/* Batch create button */}
                    {selectedCount > 0 && canBatchCreate(group.entityType) && (
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => handleBatchCreate(group)}
                        icon={<Icons.Plus className="h-3.5 w-3.5" />}
                        iconPosition="left"
                      >
                        Create {selectedCount}
                      </Button>
                    )}
                  </div>

                  {/* Values list */}
                  {isExpanded && (
                    <div className="divide-y divide-border">
                      {group.values.map((value, idx) => (
                        <div
                          key={`${value.rawValue}-${idx}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors"
                        >
                          {/* Batch selection checkbox */}
                          {canBatchCreate(group.entityType) && (
                            <div className="flex-shrink-0">
                              <Checkbox
                                checked={isValueSelected(
                                  group.entityType,
                                  value.rawValue,
                                )}
                                onCheckedChange={() =>
                                  toggleValueSelection(
                                    group.entityType,
                                    value.rawValue,
                                  )
                                }
                              />
                            </div>
                          )}

                          {/* Value name and info */}
                          <div className="flex-1 min-w-0">
                            <p className="type-p text-primary font-medium truncate">
                              {value.rawValue}
                            </p>
                            <p className="type-small text-tertiary">
                              {value.affectedRows}{" "}
                              {value.affectedRows === 1 ? "row" : "rows"}
                            </p>
                          </div>

                          {/* Mapping control */}
                          <div className="w-full max-w-[280px]">
                            <EntityValueCombobox
                              entityType={group.entityType}
                              rawValue={value.rawValue}
                              sourceColumn={value.sourceColumn}
                              jobId={jobId}
                              onMapped={() => refetch()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch progress modal */}
      <UnmappedBatchProgressModal
        open={batchProcessing}
        entityType={batchProgress.entityType}
        total={batchProgress.total}
        completed={batchProgress.completed}
        succeeded={batchProgress.succeeded}
        failed={batchProgress.failed}
        results={batchProgress.results}
        isComplete={batchProgress.completed === batchProgress.total}
        onClose={closeBatchProgress}
      />
    </TooltipProvider>
  );
}

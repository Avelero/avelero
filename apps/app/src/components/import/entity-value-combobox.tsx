"use client";

import { SeasonModal } from "@/components/modals/season-modal";
import { CategorySelect } from "@/components/select/category-select";
import {
  generatePendingEntityKey,
  usePendingEntities,
} from "@/contexts/pending-entities-context";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@v1/api/src/trpc/routers/_app";
import { colors as colorSelections } from "@v1/selections/colors";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { MaterialSheet } from "../sheets/material-sheet";
import { OperatorSheet } from "../sheets/operator-sheet";
import { ManufacturerSheet } from "../sheets/manufacturer-sheet";

type BulkValuesRouter = inferRouterOutputs<AppRouter>["bulk"]["values"];
type UnmappedValuesQueryData = BulkValuesRouter["unmapped"];

/**
 * Entity types supported by the combobox
 */
type EntityType =
  | "MATERIAL"
  | "CATEGORY"
  | "SEASON"
  | "TAG"
  | "FACILITY"
  | "MANUFACTURER"
  | "ECO_CLAIM"
  | "CERTIFICATION";

/**
 * Props for EntityValueCombobox component
 */
interface EntityValueComboboxProps {
  /** Type of entity (color, material, size, etc.) */
  entityType: EntityType;
  /** Raw value from CSV that needs mapping */
  rawValue: string;
  /** Source column name from CSV */
  sourceColumn: string;
  /** Import job ID */
  jobId: string;
  /** Callback when value is successfully mapped */
  onMapped?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Generic entity option shape
 */
interface EntityOption {
  id: string;
  name: string;
  hex?: string; // For colors
  [key: string]: unknown;
}

const CATEGORY_NAME_OVERRIDES: Record<string, string> = {
  footware: "footwear",
};

const MAX_CATEGORY_FUZZY_DISTANCE = 2;

function canonicalizeCategoryName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  return CATEGORY_NAME_OVERRIDES[sanitized] ?? sanitized;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i]![0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[a.length]?.[b.length] ?? 0;
}
function normalizeEntityType(type: string): EntityType | null {
  const normalized = type.toUpperCase();
  if (
    normalized === "MATERIAL" ||
    normalized === "CATEGORY" ||
    normalized === "SEASON" ||
    normalized === "TAG" ||
    normalized === "FACILITY" ||
    normalized === "MANUFACTURER" ||
    normalized === "ECO_CLAIM" ||
    normalized === "CERTIFICATION"
  ) {
    return normalized;
  }
  return null;
}
type CatalogDataQueryData = BulkValuesRouter["catalogData"];
type UnmappedValuesCache = UnmappedValuesQueryData;
type CategoryIndexEntry = {
  id: string;
  name: string;
  canonical: string;
};

/**
 * EntityValueCombobox Component
 *
 * Reuses existing platform select components (ColorSelect, SizeSelect, etc.)
 * with automatic mapping integration for bulk imports.
 *
 * Benefits:
 * - Single source of truth for entity selection UI
 * - Automatic mapping after entity creation
 * - Consistent UX with manual product entry
 * - Less code duplication
 *
 * @example
 * ```tsx
 * <EntityValueCombobox
 *   entityType="COLOR"
 *   rawValue="Navy Blue"
 *   sourceColumn="color_name"
 *   jobId={jobId}
 * />
 * ```
 */
export function EntityValueCombobox({
  entityType,
  rawValue,
  sourceColumn,
  jobId,
  onMapped,
  disabled = false,
  className,
}: EntityValueComboboxProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setPendingEntity, hasPendingEntity, getPendingEntity } =
    usePendingEntities();

  const key = generatePendingEntityKey(entityType, rawValue);
  const isDefined = hasPendingEntity(key);
  const ensureCategoryMutation = useMutation(
    trpc.bulk.values.ensureCategory.mutationOptions(),
  );

  const markValueAsDefined = React.useCallback(() => {
    queryClient.setQueryData(
      trpc.bulk.values.unmapped.queryKey({ jobId }),
      (existing) => {
        if (!existing) {
          return existing;
        }

        const cache: UnmappedValuesCache = existing;
        let updated = false;
        let decrement = 0;

        const updatedGroups = cache.unmappedValues.map((group) => {
          const normalizedType = normalizeEntityType(group.entityType);
          if (normalizedType !== entityType) {
            return group;
          }

          const updatedValues = group.values.map((value) => {
            if (
              value.rawValue === rawValue &&
              value.sourceColumn === sourceColumn
            ) {
              updated = true;
              if (!value.isDefined) {
                decrement += 1;
              }
              return {
                ...value,
                isDefined: true,
              };
            }
            return value;
          });

          return {
            ...group,
            values: updatedValues,
          };
        });

        if (!updated) {
          return cache;
        }

        if (decrement === 0) {
          return {
            ...cache,
            unmappedValues: updatedGroups,
          };
        }

        return {
          ...cache,
          unmappedValues: updatedGroups,
          totalUnmapped: Math.max(0, cache.totalUnmapped - decrement),
          totalDefined: cache.totalDefined + decrement,
        };
      },
    );
  }, [entityType, jobId, queryClient, rawValue, sourceColumn, trpc]);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [isMappingValue, setIsMappingValue] = React.useState(false);

  // COLOR and SIZE entity types removed - now managed as brand attributes

  // No longer need to fetch material/facility/manufacturer/season data since we're using direct creation

  // Map to existing entity mutation
  const mapToExistingMutation = useMutation(
    trpc.bulk.values.mapToExisting.mutationOptions(),
  );

  /**
   * Handle mapping an existing entity to the CSV value
   */
  const handleMapEntity = async (entityId: string, entityName: string) => {
    try {
      setIsMappingValue(true);

      await mapToExistingMutation.mutateAsync({
        jobId,
        entityType: entityType,
        rawValue,
        sourceColumn,
        entityId,
      });

      // Mark as defined in pending entities context for UI state
      setPendingEntity({
        key,
        entityType,
        rawValue,
        sourceColumn,
        jobId,
        entityData: {
          id: entityId,
          name: entityName,
        },
      });

      toast.success(`Mapped "${rawValue}" to ${entityName}`);

      markValueAsDefined();

      onMapped?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to map value";
      toast.error(errorMessage);
    } finally {
      setIsMappingValue(false);
    }
  };

  /**
   * Handle entity creation and automatic mapping
   */
  const handleEntityCreated = async (entityData: {
    id: string;
    name: string;
  }) => {
    await handleMapEntity(entityData.id, entityData.name);
  };

  // COLOR and SIZE entity types removed - now managed as brand attributes
  if ((entityType as string) === "COLOR" || (entityType as string) === "SIZE") {
    return (
      <div className={cn("w-full", className)}>
        <div className="px-3 py-2 text-sm text-tertiary">
          {(entityType as string)} entity type is no longer supported. Colors and sizes are now managed as brand attributes.
        </div>
      </div>
    );
  }

  // COLOR and SIZE entity types removed - now managed as brand attributes

  // Render CATEGORY using CategorySelect component (read-only mapping)
  if (entityType === "CATEGORY") {
    // Fetch categories from catalog
    const { data: categoriesData } = useQuery({
      ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
      select: (data) => data.categories as CatalogDataQueryData["categories"],
    });

    // State for the selected category id
    const [categoryValue, setCategoryValue] = React.useState<string | null>(
      null,
    );

    const categoryIndex = React.useMemo<CategoryIndexEntry[]>(() => {
      if (!categoriesData) return [];
      return categoriesData.map((category) => ({
        id: category.id,
        name: category.name,
        canonical: canonicalizeCategoryName(category.name),
      }));
    }, [categoriesData]);

    // Find matching category ID from the selected path
    // CategorySelect returns a path like "Men's / Tops / T-Shirts"
    // We need to extract the leaf category name and find its ID
    const findCategoryId = React.useCallback(
      (categoryPath: string | null): { id: string; name: string } | null => {
        if (
          !categoryIndex.length ||
          !categoryPath ||
          categoryPath === "Select category"
        ) {
          return null;
        }

        const idMatch = categoryIndex.find(
          (candidate) => candidate.id === categoryPath,
        );
        if (idMatch) {
          return { id: idMatch.id, name: idMatch.name };
        }

        const parts = categoryPath
          .split("/")
          .map((p) => p.trim())
          .filter(Boolean);
        const leafName = parts[parts.length - 1];

        if (!leafName) return null;

        const canonicalLeaf = canonicalizeCategoryName(leafName);
        if (!canonicalLeaf) return null;

        const directMatch = categoryIndex.find(
          (candidate) => candidate.canonical === canonicalLeaf,
        );

        if (directMatch) {
          return { id: directMatch.id, name: directMatch.name };
        }

        let bestMatch: { id: string; name: string; distance: number } | null =
          null;

        for (const candidate of categoryIndex) {
          const distance = levenshteinDistance(
            canonicalLeaf,
            candidate.canonical,
          );
          if (
            distance <= MAX_CATEGORY_FUZZY_DISTANCE &&
            (bestMatch === null || distance < bestMatch.distance)
          ) {
            bestMatch = {
              id: candidate.id,
              name: candidate.name,
              distance,
            };
          }
        }

        if (bestMatch) {
          return { id: bestMatch.id, name: bestMatch.name };
        }

        return null;
      },
      [categoryIndex],
    );

    const mappedCategory = getPendingEntity(key)?.entityData?.name || null;
    const buttonLabel = isDefined
      ? `Mapped: "${mappedCategory || rawValue}"`
      : isMappingValue
        ? "Mapping..."
        : "Select category";

    const buttonIcon = isDefined ? (
      <Icons.CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    ) : (
      <Icons.ChevronDown className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
    );

    return (
      <div className={cn("w-full", className)}>
        {isDefined ? (
          // Show mapped state as a disabled button
          <button
            type="button"
            disabled={true}
            className={cn(
              "w-full h-9 px-3 flex items-center justify-between gap-2",
              "border border-green-600 bg-green-50 rounded cursor-default",
              className,
            )}
          >
            <span className="type-p truncate text-green-700">
              {buttonLabel}
            </span>
            {buttonIcon}
          </button>
        ) : (
          // Show CategorySelect for unmapped values
          <div
            className={cn(
              (disabled || isMappingValue) && "opacity-50 pointer-events-none",
            )}
          >
            <CategorySelect
              value={categoryValue}
              onChange={async (categoryPath) => {
                setCategoryValue(categoryPath);
                if (
                  categoryPath &&
                  categoryPath !== "Select category" &&
                  !isMappingValue &&
                  !disabled
                ) {
                  let resolvedCategory = findCategoryId(categoryPath);

                  if (!resolvedCategory) {
                    const pathSegments = categoryPath
                      .split("/")
                      .map((segment) => segment.trim())
                      .filter(Boolean);

                    if (pathSegments.length > 0) {
                      try {
                        const result = await ensureCategoryMutation.mutateAsync(
                          {
                            jobId,
                            path: pathSegments,
                          },
                        );

                        if (result?.id) {
                          const latestSegment =
                            pathSegments[pathSegments.length - 1] ?? rawValue;
                          resolvedCategory = {
                            id: result.id,
                            name: latestSegment,
                          };

                          await queryClient.invalidateQueries({
                            queryKey: trpc.bulk.values.catalogData.queryKey({
                              jobId,
                            }),
                          });
                        }
                      } catch (ensureError) {
                        const message =
                          ensureError instanceof Error
                            ? ensureError.message
                            : "Failed to sync category";
                        toast.error(message);
                      }
                    }
                  }

                  if (resolvedCategory) {
                    await handleMapEntity(
                      resolvedCategory.id,
                      resolvedCategory.name,
                    );
                    setCategoryValue(null); // Reset after mapping
                  } else {
                    toast.error(
                      `Category "${categoryPath ?? rawValue}" not found in database`,
                    );
                    setCategoryValue(null); // Reset on error
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // For MATERIAL, SEASON, FACILITY, MANUFACTURER - define button (stores data for batch creation)
  if (
    entityType === "MATERIAL" ||
    entityType === "SEASON" ||
    entityType === "FACILITY" ||
    entityType === "MANUFACTURER"
  ) {
    const handleDefineClick = () => {
      if (entityType === "SEASON") {
        setSeasonModalOpen(true);
      } else {
        setSheetOpen(true);
      }
    };

    const buttonLabel = isDefined
      ? `Edit "${rawValue}"`
      : `Define "${rawValue}"`;

    const buttonIcon = isDefined ? (
      <Icons.CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    ) : (
      <Icons.Plus className="h-3.5 w-3.5 text-secondary flex-shrink-0" />
    );

    return (
      <>
        <button
          type="button"
          onClick={() => !disabled && handleDefineClick()}
          disabled={disabled}
          className={cn(
            "w-full h-9 px-3 flex items-center justify-between gap-2",
            "border border-border rounded bg-background hover:bg-accent transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isDefined && "border-green-600 bg-green-50",
            className,
          )}
        >
          <span
            className={cn(
              "type-p truncate",
              isDefined ? "text-green-700" : "text-secondary",
            )}
          >
            {buttonLabel}
          </span>
          {buttonIcon}
        </button>

        {/* Entity-specific sheet/modal */}
        {entityType === "MATERIAL" && (
          <MaterialSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onMaterialCreated={(materialData) => {
              // Store material data for batch creation
              setPendingEntity({
                key,
                entityType: "MATERIAL",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  name: materialData.name || rawValue,
                  country_of_origin: materialData.countryOfOrigin,
                  recyclable: materialData.recyclable,
                  certification_id: materialData.certificationId,
                },
              });

              markValueAsDefined();

              setSheetOpen(false);
              toast.success(`Material "${rawValue}" defined`);
              onMapped?.();
            }}
          />
        )}
        {entityType === "FACILITY" && (
          <OperatorSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onOperatorCreated={(facilityData) => {
              // Store facility data for batch creation
              setPendingEntity({
                key,
                entityType: "FACILITY",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  display_name: facilityData.name || rawValue,
                  // Add other facility fields
                },
              });

              markValueAsDefined();

              setSheetOpen(false);
              toast.success(`Facility "${rawValue}" defined`);
              onMapped?.();
            }}
          />
        )}
        {entityType === "MANUFACTURER" && (
          <ManufacturerSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onManufacturerCreated={(manufacturerData: any) => {
              // Store manufacturer data for batch creation
              setPendingEntity({
                key,
                entityType: "MANUFACTURER",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  name: manufacturerData.name || rawValue,
                  // Add other manufacturer fields
                },
              });

              markValueAsDefined();

              setSheetOpen(false);
              toast.success(`Manufacturer "${rawValue}" defined`);
              onMapped?.();
            }}
          />
        )}
        {entityType === "SEASON" && (
          <SeasonModal
            open={seasonModalOpen}
            onOpenChange={setSeasonModalOpen}
            initialName={rawValue}
            onSave={(seasonData) => {
              const formatDate = (value: Date | null) =>
                value ? value.toISOString().slice(0, 10) : undefined;

              // Store season data for batch creation
              setPendingEntity({
                key,
                entityType: "SEASON",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  name: seasonData.name || rawValue,
                  start_date: formatDate(seasonData.startDate),
                  end_date: formatDate(seasonData.endDate),
                  ongoing: seasonData.isOngoing,
                },
              });

              markValueAsDefined();

              setSeasonModalOpen(false);
              toast.success(`Season "${rawValue}" defined`);
              onMapped?.();
            }}
          />
        )}
      </>
    );
  }

  // For other unsupported entity types (TAG, ECO_CLAIM, CERTIFICATION)
  // Show a disabled placeholder
  return (
    <button
      type="button"
      disabled={true}
      className={cn(
        "w-full h-9 px-3 flex items-center justify-between gap-2",
        "border border-border rounded bg-background",
        "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span className="type-p text-tertiary truncate">
        {entityType} not supported
      </span>
      <Icons.AlertCircle className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
    </button>
  );
}

"use client";

import { CategorySelect } from "@/components/select/category-select";
import { SeasonModal } from "@/components/modals/season-modal";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ShowcaseBrandSheet } from "../sheets/showcase-brand-sheet";
import { OperatorSheet } from "../sheets/operator-sheet";
import { colors as colorSelections } from "@v1/selections/colors";
import { usePendingEntities, generatePendingEntityKey } from "@/contexts/pending-entities-context";

/**
 * Entity types supported by the combobox
 */
type EntityType =
  | "COLOR"
  | "MATERIAL"
  | "SIZE"
  | "CATEGORY"
  | "SEASON"
  | "TAG"
  | "FACILITY"
  | "SHOWCASE_BRAND"
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

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}
type UnmappedValuesCache = {
  unmappedValues: Array<{
    entityType: EntityType;
    values: Array<{
      rawValue: string;
      sourceColumn: string;
      isDefined?: boolean;
      [key: string]: unknown;
    }>;
  }>;
  totalUnmapped: number;
  totalDefined?: number;
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
  const { setPendingEntity, hasPendingEntity, getPendingEntity } = usePendingEntities();

  const key = generatePendingEntityKey(entityType, rawValue);
  const isDefined = hasPendingEntity(key);
  const ensureCategoryMutation = useMutation(
    trpc.bulk.values.ensureCategory.mutationOptions(),
  );

  const markValueAsDefined = React.useCallback(() => {
    queryClient.setQueryData(
      trpc.bulk.values.unmapped.queryKey({ jobId }),
      (existing: UnmappedValuesCache | undefined) => {
        if (!existing) {
          return existing;
        }

        let updated = false;
        let decrement = 0;

        const updatedGroups = existing.unmappedValues.map((group) => {
          if (group.entityType !== entityType) {
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
          return existing;
        }

        if (decrement === 0) {
          return {
            ...existing,
            unmappedValues: updatedGroups,
          };
        }

        const currentTotal = Number(existing.totalUnmapped ?? 0);
        const currentDefined = Number(existing.totalDefined ?? 0);

        return {
          ...existing,
          unmappedValues: updatedGroups,
          totalUnmapped: Math.max(0, currentTotal - decrement),
          totalDefined: currentDefined + decrement,
        };
      },
    );
  }, [entityType, jobId, queryClient, rawValue, sourceColumn, trpc]);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [isMappingValue, setIsMappingValue] = React.useState(false);

  // Fetch entity data (cached by parent component)
  const { data: colorsData } = useQuery({
    ...trpc.brand.colors.list.queryOptions(undefined),
    enabled: entityType === "COLOR",
  });

  // No longer need to fetch material/facility/showcase/season data since we're using direct creation

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

  // Render COLOR using a simple combobox (READ-ONLY - no creation)
  if (entityType === "COLOR") {
    // Match database color names to static color selections for hex values
    const colorOptions = (colorsData?.data || []).map((c: any) => {
      // Try to find matching color in selections by name (case-insensitive)
      const colorKey = c.name.toUpperCase().replace(/\s+/g, "_");
      const selectionColor = colorSelections[colorKey as keyof typeof colorSelections];

      return {
        id: c.id,
        name: c.name,
        hex: selectionColor?.hex || "808080", // Use static hex or fallback to gray
      };
    });

    const [colorOpen, setColorOpen] = React.useState(false);
    const [colorSearch, setColorSearch] = React.useState("");

    React.useEffect(() => {
      if (disabled || isMappingValue) {
        setColorOpen(false);
      }
    }, [disabled, isMappingValue]);

    const filteredColors = React.useMemo(() => {
      if (!colorSearch) return colorOptions;
      return colorOptions.filter((c) =>
        c.name.toLowerCase().includes(colorSearch.toLowerCase())
      );
    }, [colorOptions, colorSearch]);

    const buttonLabel = isDefined
      ? `Mapped: "${getPendingEntity(key)?.entityData?.name || rawValue}"`
      : isMappingValue
        ? "Mapping..."
        : "Select color";

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
          <Popover
            modal
            open={colorOpen}
            onOpenChange={(next) => {
              if (!next) {
                setColorOpen(false);
                return;
              }

              if (disabled || isMappingValue) {
                return;
              }

              setColorOpen(true);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                disabled={disabled || isMappingValue}
                className="w-full justify-between h-9"
                icon={buttonIcon}
              >
                <span className="type-p truncate text-secondary">
                  {buttonLabel}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-60 p-0 !z-[100]"
              align="start"
              sideOffset={4}
              inline
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search colors..."
                  value={colorSearch}
                  onValueChange={setColorSearch}
                />
                <CommandList onWheel={(event) => event.stopPropagation()}>
                  <CommandGroup>
                    {filteredColors.length > 0 ? (
                      filteredColors.map((color) => (
                        <CommandItem
                          key={color.id}
                          value={color.name}
                          onSelect={async () => {
                            await handleMapEntity(color.id, color.name);
                            setColorOpen(false);
                            setColorSearch("");
                          }}
                          className="justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3.5 w-3.5 rounded-full border border-border"
                              style={{ backgroundColor: `#${color.hex}` }}
                            />
                            <span className="type-p text-primary">
                              {color.name}
                            </span>
                          </div>
                        </CommandItem>
                      ))
                    ) : (
                      <div className="px-3 py-8 text-center">
                        <p className="type-p text-tertiary">
                          No colors found
                        </p>
                      </div>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Render SIZE using SizeSelect component (allows selecting existing or creating new)
  if (entityType === "SIZE") {
    // Fetch sizes from catalog
    const { data: sizesData } = useQuery({
      ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
      select: (data) => data.sizes,
    });

    const availableSizes = React.useMemo(() => {
      return sizesData?.map((s: any) => s.name) || [];
    }, [sizesData]);

    const [sizeOpen, setSizeOpen] = React.useState(false);
    const [sizeSearch, setSizeSearch] = React.useState("");
    const handleCreateSize = React.useCallback(
      (input?: string) => {
        const fallbackValue = input ?? sizeSearch ?? rawValue;
        const proposedName = fallbackValue.trim() || rawValue.trim();
        if (!proposedName) {
          return;
        }

        setPendingEntity({
          key,
          entityType: "SIZE",
          rawValue,
          sourceColumn,
          jobId,
          entityData: {
            name: proposedName,
          },
        });

        markValueAsDefined();

        setSizeOpen(false);
        setSizeSearch("");
        toast.success(`Size "${proposedName}" defined`);
        onMapped?.();
      },
      [jobId, key, markValueAsDefined, onMapped, rawValue, setPendingEntity, sizeSearch, sourceColumn],
    );

    React.useEffect(() => {
      if (disabled || isMappingValue) {
        setSizeOpen(false);
      }
    }, [disabled, isMappingValue]);

    const normalizedSizeSearch = sizeSearch.trim();

    const filteredSizes = React.useMemo(() => {
      if (!normalizedSizeSearch) return availableSizes;
      const searchLower = normalizedSizeSearch.toLowerCase();
      return availableSizes.filter((s: string) =>
        s.toLowerCase().includes(searchLower)
      );
    }, [availableSizes, normalizedSizeSearch]);

    const showCreateOption =
      normalizedSizeSearch.length > 0 &&
      !availableSizes.some(
        (s: string) => s.toLowerCase() === normalizedSizeSearch.toLowerCase()
      );

    const buttonLabel = isDefined
      ? `Mapped: "${getPendingEntity(key)?.entityData?.name || rawValue}"`
      : "Select or create size";

    const buttonIcon = isDefined ? (
      <Icons.CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    ) : (
      <Icons.ChevronDown className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
    );

    return (
      <>
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
            <Popover
              modal
              open={sizeOpen}
              onOpenChange={(next) => {
                if (!next) {
                  setSizeOpen(false);
                  return;
                }

                if (disabled || isMappingValue) {
                  return;
                }

                setSizeOpen(true);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  disabled={disabled}
                  className="w-full justify-between h-9"
                  icon={buttonIcon}
                >
                  <span className="type-p truncate text-secondary">
                    {buttonLabel}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-60 p-0 !z-[100]"
                align="start"
                sideOffset={4}
                inline
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={`Search sizes or type "${rawValue}"...`}
                    value={sizeSearch}
                    onValueChange={setSizeSearch}
                  />
                  <CommandList onWheel={(event) => event.stopPropagation()}>
                    <CommandGroup>
                      {filteredSizes.length > 0 ? (
                        filteredSizes.map((size: string) => (
                          <CommandItem
                            key={size}
                            value={size}
                            onSelect={async () => {
                              // Find the size ID from sizesData
                              const sizeData = sizesData?.find(
                                (s: any) => s.name === size
                              );
                              if (sizeData) {
                                await handleMapEntity(sizeData.id, sizeData.name);
                              }
                              setSizeOpen(false);
                              setSizeSearch("");
                            }}
                            className="justify-between"
                          >
                            <span className="type-p text-primary">{size}</span>
                          </CommandItem>
                        ))
                      ) : sizeSearch && showCreateOption ? (
                        <CommandItem
                          value={normalizedSizeSearch}
                          onSelect={() => {
                            handleCreateSize(normalizedSizeSearch);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Icons.Plus className="h-3.5 w-3.5" />
                            <span className="type-p text-primary">
                              Create &quot;{normalizedSizeSearch}&quot;
                            </span>
                          </div>
                        </CommandItem>
                      ) : !normalizedSizeSearch ? (
                        <div className="px-3 py-8 text-center">
                          <p className="type-p text-tertiary">
                            Type &quot;{rawValue}&quot; to create or select existing
                          </p>
                        </div>
                      ) : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </>
    );
  }

  // Render CATEGORY using CategorySelect component (read-only mapping)
  if (entityType === "CATEGORY") {
    // Fetch categories from catalog
    const { data: categoriesData } = useQuery({
      ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
      select: (data) => data.categories,
    });

    // State for the selected category path
    const [categoryValue, setCategoryValue] = React.useState<string>("Select category");

    const categoryIndex = React.useMemo(() => {
      if (!categoriesData) return [] as Array<{ id: string; name: string; canonical: string }>;
      return categoriesData.map((category: any) => ({
        id: category.id,
        name: category.name,
        canonical: canonicalizeCategoryName(category.name),
      }));
    }, [categoriesData]);

    // Find matching category ID from the selected path
    // CategorySelect returns a path like "Men's / Tops / T-Shirts"
    // We need to extract the leaf category name and find its ID
    const findCategoryId = React.useCallback(
      (categoryPath: string): { id: string; name: string } | null => {
        if (!categoryIndex.length || !categoryPath || categoryPath === "Select category") {
          return null;
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

        let bestMatch: { id: string; name: string; distance: number } | null = null;

        categoryIndex.forEach((candidate) => {
          const distance = levenshteinDistance(canonicalLeaf, candidate.canonical);
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
        });

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
            className={cn((disabled || isMappingValue) && "opacity-50 pointer-events-none")}
          >
            <CategorySelect
              value={categoryValue}
              onChange={async (categoryPath) => {
                setCategoryValue(categoryPath);
                if (categoryPath && categoryPath !== "Select category" && !isMappingValue && !disabled) {
                  let resolvedCategory = findCategoryId(categoryPath);

                  if (!resolvedCategory) {
                    const pathSegments = categoryPath
                      .split("/")
                      .map((segment) => segment.trim())
                      .filter(Boolean);

                    if (pathSegments.length > 0) {
                      try {
                        const result = await ensureCategoryMutation.mutateAsync({
                          jobId,
                          path: pathSegments,
                        });

                        if (result?.id) {
                          resolvedCategory = {
                            id: result.id,
                            name: pathSegments[pathSegments.length - 1],
                          };

                          await queryClient.invalidateQueries({
                            queryKey: trpc.bulk.values.catalogData.queryKey({ jobId }),
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
                    await handleMapEntity(resolvedCategory.id, resolvedCategory.name);
                    setCategoryValue("Select category"); // Reset after mapping
                  } else {
                    toast.error(`Category "${categoryPath}" not found in database`);
                    setCategoryValue("Select category"); // Reset on error
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // For MATERIAL, SEASON, FACILITY, SHOWCASE_BRAND - define button (stores data for batch creation)
  if (
    entityType === "MATERIAL" ||
    entityType === "SEASON" ||
    entityType === "FACILITY" ||
    entityType === "SHOWCASE_BRAND"
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
          <span className={cn("type-p truncate", isDefined ? "text-green-700" : "text-secondary")}>
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
        {entityType === "SHOWCASE_BRAND" && (
          <ShowcaseBrandSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onBrandCreated={(brandData) => {
              // Store showcase brand data for batch creation
              setPendingEntity({
                key,
                entityType: "SHOWCASE_BRAND",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  name: brandData.name || rawValue,
                  // Add other brand fields
                },
              });

              markValueAsDefined();

              setSheetOpen(false);
              toast.success(`Showcase brand "${rawValue}" defined`);
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
              // Store season data for batch creation
              setPendingEntity({
                key,
                entityType: "SEASON",
                rawValue,
                sourceColumn,
                jobId,
                entityData: {
                  name: seasonData.name || rawValue,
                  start_date: seasonData.startDate,
                  end_date: seasonData.endDate,
                  is_ongoing: seasonData.ongoing,
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

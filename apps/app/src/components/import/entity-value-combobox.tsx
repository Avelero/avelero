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
 *   onMapped={() => refetch()}
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

      // Invalidate unmapped values query
      await queryClient.invalidateQueries({
        queryKey: trpc.bulk.values.unmapped.queryKey({ jobId }),
      });

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
          <Popover open={colorOpen && !disabled} onOpenChange={setColorOpen} modal={true}>
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
            <PopoverContent className="w-60 p-0" align="start" sideOffset={4}>
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search colors..."
                  value={colorSearch}
                  onValueChange={setColorSearch}
                />
                <CommandList>
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

  // Render SIZE - Click to define (stores data for batch creation)
  // For bulk import, we just create a simple size with the CSV value as the name
  if (entityType === "SIZE") {
    const buttonLabel = isDefined
      ? `Defined: "${rawValue}"`
      : `Define "${rawValue}"`;

    const buttonIcon = isDefined ? (
      <Icons.CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    ) : (
      <Icons.Plus className="h-3.5 w-3.5 text-secondary flex-shrink-0" />
    );

    return (
      <button
        type="button"
        onClick={() => {
          if (!disabled && !isDefined) {
            // For bulk import, simply store the size name directly
            // No complex modal needed - just create a size with this name
            setPendingEntity({
              key,
              entityType: "SIZE",
              rawValue,
              sourceColumn,
              jobId,
              entityData: {
                name: rawValue, // Simple size name
              },
            });
            toast.success(`Size "${rawValue}" defined`);
            onMapped?.();
          }
        }}
        disabled={disabled}
        className={cn(
          "w-full h-9 px-3 flex items-center justify-between gap-2",
          "border border-border rounded bg-background hover:bg-accent transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isDefined && "border-green-600 bg-green-50 cursor-default",
          className,
        )}
      >
        <span className={cn("type-p truncate", isDefined ? "text-green-700" : "text-secondary")}>
          {buttonLabel}
        </span>
        {buttonIcon}
      </button>
    );
  }

  // Render CATEGORY using CategorySelect component (read-only mapping)
  if (entityType === "CATEGORY") {
    // Fetch categories from catalog
    const { data: categoriesData } = useQuery({
      ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
      select: (data) => data.categories,
    });

    // Find matching category ID from the selected path
    // CategorySelect returns a path like "Men's / Tops / T-Shirts"
    // We need to extract the leaf category name and find its ID
    const findCategoryId = (categoryPath: string): { id: string; name: string } | null => {
      if (!categoriesData || !categoryPath || categoryPath === "Select category") {
        return null;
      }

      // Extract leaf category from path (e.g., "Men's / Tops / T-Shirts" -> "T-Shirts")
      const parts = categoryPath.split("/").map((p) => p.trim());
      const leafName = parts[parts.length - 1];

      if (!leafName) return null;

      // Find matching category in database by name (case-insensitive)
      const category = categoriesData.find(
        (c: any) => c.name.toLowerCase() === leafName.toLowerCase()
      );

      return category ? { id: category.id, name: category.name } : null;
    };

    const buttonLabel = isDefined
      ? `Mapped: "${getPendingEntity(key)?.entityData?.name || rawValue}"`
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
          <CategorySelect
            value=""
            onChange={async (categoryPath) => {
              if (categoryPath && categoryPath !== "Select category" && !isMappingValue && !disabled) {
                const match = findCategoryId(categoryPath);
                if (match) {
                  await handleMapEntity(match.id, match.name);
                } else {
                  toast.error(`Category "${categoryPath}" not found in database`);
                }
              }
            }}
            label=""
            className={cn("h-9", (disabled || isMappingValue) && "opacity-50 pointer-events-none")}
          />
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

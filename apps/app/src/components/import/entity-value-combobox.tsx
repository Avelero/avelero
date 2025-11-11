"use client";

import { ColorSelect } from "@/components/select/color-select";
import { SizeSelect } from "@/components/select/size-select";
import { SeasonSelect } from "@/components/select/season-select";
import { TagSelect } from "@/components/select/tag-select";
import { CategorySelect } from "@/components/select/category-select";
import { SeasonModal } from "@/components/modals/season-modal";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { ColorSheet } from "../sheets/color-sheet";
import { MaterialSheet } from "../sheets/material-sheet";
import { ShowcaseBrandSheet } from "../sheets/showcase-brand-sheet";
import { OperatorSheet } from "../sheets/operator-sheet";
import { SizeModal } from "../modals/size-modal";

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

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [isMappingValue, setIsMappingValue] = React.useState(false);

  // Reset search term when dropdown closes
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  // Fetch entity data (cached by parent component)
  const { data: colorsData } = useQuery({
    ...trpc.brand.colors.list.queryOptions(undefined),
    enabled: entityType === "COLOR",
  });

  const { data: materialsData } = useQuery({
    ...trpc.brand.materials.list.queryOptions({}),
    enabled: entityType === "MATERIAL",
  });

  const { data: sizesData } = useQuery({
    ...trpc.brand.sizes.list.queryOptions({}),
    enabled: entityType === "SIZE",
  });

  const { data: facilitiesData } = useQuery({
    ...trpc.brand.facilities.list.queryOptions({}),
    enabled: entityType === "FACILITY",
  });

  const { data: showcaseBrandsData, isLoading: isLoadingShowcaseBrands } =
    useQuery({
      ...trpc.brand.showcaseBrands.list.queryOptions({}),
      enabled: entityType === "SHOWCASE_BRAND",
    });

  const { data: seasonsData, isLoading: isLoadingSeasons } = useQuery({
    ...trpc.brand.seasons.list.queryOptions({}),
    enabled: entityType === "SEASON",
  });

  // Determine if any data is loading
  const isLoadingData =
    (entityType === "MATERIAL" && !materialsData) ||
    (entityType === "FACILITY" && !facilitiesData) ||
    (entityType === "SHOWCASE_BRAND" && isLoadingShowcaseBrands) ||
    (entityType === "SEASON" && isLoadingSeasons);

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

      // Type guard: CATEGORY should never reach this point since it's read-only
      if (entityType === "CATEGORY") {
        throw new Error("Categories cannot be mapped");
      }

      await mapToExistingMutation.mutateAsync({
        jobId,
        entityType: entityType as Exclude<EntityType, "CATEGORY">,
        rawValue,
        sourceColumn,
        entityId,
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

  // Render COLOR using ColorSelect component
  if (entityType === "COLOR") {
    const colorOptions = (colorsData?.data || []).map((c: any) => ({
      name: c.name,
      hex: "808080", // Default gray - actual hex not stored in DB
    }));

    return (
      <>
        <div className={cn("w-full", className)}>
          <ColorSelect
            value={[]} // Single-select for mapping
            onValueChange={async (colors) => {
              if (colors.length > 0 && colors[0]) {
                const selectedColor = colorsData?.data.find(
                  (c: any) => c.name === colors[0]?.name,
                );
                if (selectedColor) {
                  await handleMapEntity(selectedColor.id, selectedColor.name);
                }
              }
            }}
            defaultColors={colorOptions}
            placeholder={isMappingValue ? "Mapping..." : rawValue}
            disabled={disabled || isMappingValue}
            className="h-9"
          />
        </div>
        <ColorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          initialName={rawValue}
          onColorCreated={handleEntityCreated}
        />
      </>
    );
  }

  // Render SIZE using SizeSelect component
  if (entityType === "SIZE") {
    const sizeOptions = (sizesData?.data || []).map((s: any) => s.name);

    return (
      <>
        <SizeSelect
          value={null}
          onValueChange={async (sizeName) => {
            const selectedSize = sizesData?.data.find(
              (s: any) => s.name === sizeName,
            );
            if (selectedSize) {
              await handleMapEntity(selectedSize.id, selectedSize.name);
            }
          }}
          availableSizes={sizeOptions}
          onCreateNew={() => setSizeModalOpen(true)}
          placeholder={isMappingValue ? "Mapping..." : "Select or create"}
          disabled={disabled || isMappingValue}
          className={className}
        />
        <SizeModal
          open={sizeModalOpen}
          onOpenChange={setSizeModalOpen}
          prefillSize={rawValue}
          onSave={async () => {
            setSizeModalOpen(false);
            // Refetch and find the created size
            await queryClient.invalidateQueries({
              queryKey: trpc.brand.sizes.list.queryKey({}),
            });
            await new Promise((resolve) => setTimeout(resolve, 300));
            const freshSizesData = queryClient.getQueryData(
              trpc.brand.sizes.list.queryKey({}),
            ) as { data: { id: string; name: string }[] } | undefined;
            const createdSize = freshSizesData?.data.find(
              (s) => s.name.toLowerCase() === rawValue.toLowerCase(),
            );
            if (createdSize) {
              await handleEntityCreated(createdSize);
            } else {
              toast.success(`Size "${rawValue}" created`);
              onMapped?.();
            }
          }}
        />
      </>
    );
  }

  // Render CATEGORY using CategorySelect component (read-only mapping)
  if (entityType === "CATEGORY") {
    return (
      <div className={cn("w-full", className)}>
        <CategorySelect
          value=""
          onChange={async (categoryPath) => {
            if (categoryPath && categoryPath !== "Select category") {
              // For categories, we use the full path as both ID and name
              await handleMapEntity(categoryPath, categoryPath);
            }
          }}
          label=""
          className="h-9"
        />
      </div>
    );
  }

  // For other entity types, use generic dropdown
  const entities = React.useMemo(() => {
    switch (entityType) {
      case "MATERIAL":
        return (materialsData?.data || []).map((m: any) => ({
          id: m.id,
          name: m.name,
        }));
      case "FACILITY":
        return (facilitiesData?.data || []).map((f: any) => ({
          id: f.id,
          name: f.name,
        }));
      case "SHOWCASE_BRAND":
        return (showcaseBrandsData?.data || []).map((b: any) => ({
          id: b.id,
          name: b.name,
        }));
      case "SEASON":
        return (seasonsData?.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
        }));
      case "TAG":
        // Tags don't have a list endpoint yet, they're created on-the-fly
        return [];
      default:
        return [];
    }
  }, [entityType, materialsData, facilitiesData, showcaseBrandsData]);

  // Filter entities for generic dropdown
  const filteredEntities = React.useMemo(() => {
    if (!searchTerm) return entities;
    return entities.filter((e: EntityOption) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [entities, searchTerm]);

  // Generic dropdown (for materials, facilities, showcase brands, seasons, tags)
  // CATEGORY is handled via early return, so it won't reach this point
  const canCreate =
    entityType !== "ECO_CLAIM" && entityType !== "CERTIFICATION";

  const handleSelectExisting = async (entity: EntityOption) => {
    await handleMapEntity(entity.id, entity.name);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setOpen(false);
    setSheetOpen(true);
  };

  /**
   * Render entity-specific sheet/modal for generic dropdown
   * (COLOR, SIZE, CATEGORY are handled by early returns above)
   */
  const renderEntitySheet = () => {
    switch (entityType) {
      case "MATERIAL":
        return (
          <MaterialSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onMaterialCreated={handleEntityCreated}
          />
        );
      case "FACILITY":
        return (
          <OperatorSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onOperatorCreated={handleEntityCreated}
          />
        );
      case "SHOWCASE_BRAND":
        return (
          <ShowcaseBrandSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialName={rawValue}
            onBrandCreated={handleEntityCreated}
          />
        );
      case "SEASON":
        return (
          <SeasonModal
            open={seasonModalOpen}
            onOpenChange={setSeasonModalOpen}
            initialName={rawValue}
            onSave={async (season) => {
              setSeasonModalOpen(false);
              // Map the created season using its UUID from the tRPC mutation
              await handleEntityCreated({
                id: season.id,
                name: season.name,
              });
            }}
          />
        );
      case "TAG":
        // Tags are auto-created with rawValue as both ID and name
        // No modal needed, handled via generic dropdown
        return null;
      case "ECO_CLAIM":
      case "CERTIFICATION":
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || isMappingValue}
            className={cn(
              "w-full h-9 px-3 flex items-center justify-between gap-2",
              "border border-border rounded bg-background hover:bg-accent transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              (disabled || isMappingValue) && "cursor-wait",
              className,
            )}
          >
            <span className="type-p text-secondary truncate">
              {isMappingValue ? "Mapping..." : "Select or create"}
            </span>
            {isMappingValue ? (
              <Icons.Spinner className="h-3.5 w-3.5 animate-spin text-secondary flex-shrink-0" />
            ) : (
              <Icons.ChevronDown className="h-3.5 w-3.5 text-secondary flex-shrink-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${entityType.toLowerCase()}s...`}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {isLoadingData ? (
                <div className="flex items-center justify-center py-6">
                  <Icons.Spinner className="h-5 w-5 animate-spin text-brand" />
                  <span className="ml-2 text-sm text-secondary">
                    Loading {entityType.toLowerCase()}s...
                  </span>
                </div>
              ) : (
                <>
                  {canCreate && (
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${rawValue}`}
                        onSelect={handleCreateNew}
                        disabled={isMappingValue}
                        className="text-brand hover:text-brand"
                      >
                        <div className="flex items-center gap-2">
                          <Icons.Plus className="h-3.5 w-3.5" />
                          <span className="type-p">
                            Create &quot;{rawValue}&quot;
                          </span>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  )}

                  {filteredEntities.length > 0 && (
                    <CommandGroup heading="Existing">
                      {filteredEntities.map((entity: EntityOption) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.id}
                          onSelect={() => handleSelectExisting(entity)}
                          disabled={isMappingValue}
                        >
                          <span className="type-p truncate">{entity.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {!canCreate && filteredEntities.length === 0 && (
                    <CommandEmpty>
                      <p className="type-small text-tertiary">
                        No matches found
                      </p>
                    </CommandEmpty>
                  )}

                  {canCreate &&
                    filteredEntities.length === 0 &&
                    !searchTerm && (
                      <div className="px-3 py-6 text-center">
                        <p className="type-small text-tertiary">
                          No existing {entityType.toLowerCase()}s
                        </p>
                        <p className="type-small text-tertiary mt-1">
                          Create "{rawValue}" above
                        </p>
                      </div>
                    )}

                  {canCreate && filteredEntities.length === 0 && searchTerm && (
                    <CommandEmpty>
                      <p className="type-small text-tertiary">
                        No matches found
                      </p>
                    </CommandEmpty>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Entity-specific sheet/modal */}
      {renderEntitySheet()}
    </>
  );
}

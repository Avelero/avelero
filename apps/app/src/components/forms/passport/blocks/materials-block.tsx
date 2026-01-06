"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { countries as countryData } from "@v1/selections/countries";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";
import { MaterialSheet } from "../../../sheets/material-sheet";

interface Material {
  id: string;
  name: string;
  countries: string[];
  percentage: string;
}

const MaterialDropdown = ({
  material,
  onMaterialChange,
  onCreateMaterial,
  availableMaterials,
  excludeMaterialIds,
}: {
  material: string;
  onMaterialChange: (material: string) => void;
  onCreateMaterial: (searchTerm: string) => void;
  availableMaterials: Array<{ id: string; name: string }>;
  excludeMaterialIds?: string[];
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [pendingSelectedId, setPendingSelectedId] = React.useState<
    string | null
  >(null);

  // Filter out materials that are already added
  const filteredMaterials = React.useMemo(() => {
    if (!excludeMaterialIds || excludeMaterialIds.length === 0) {
      return availableMaterials;
    }
    const excludeSet = new Set(excludeMaterialIds);
    return availableMaterials.filter((m) => {
      if (pendingSelectedId && m.id === pendingSelectedId) {
        return true; // allow the recently selected option to persist during close animation
      }
      return !excludeSet.has(m.id);
    });
  }, [availableMaterials, excludeMaterialIds, pendingSelectedId]);

  const materialNames = React.useMemo(
    () => filteredMaterials.map((m) => m.name),
    [filteredMaterials],
  );

  const handleSelect = (selectedMaterial: string) => {
    const selected = availableMaterials.find(
      (m) => m.name === selectedMaterial,
    );
    if (selected?.id) {
      setPendingSelectedId(selected.id);
    }
    onMaterialChange(selectedMaterial);
    setDropdownOpen(false);
    setSearchQuery("");
    if (selected?.id) {
      setTimeout(() => setPendingSelectedId(null), 180);
    }
  };

  const handleCreate = () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery && !materialNames.includes(trimmedQuery)) {
      // Open material sheet for creation
      onCreateMaterial(trimmedQuery);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const filteredOptions = materialNames.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex items-center w-full h-full">
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              "group w-full h-full px-4 py-2 flex items-center cursor-pointer transition-all",
            )}
          >
            <div
              className={cn(
                "border-b border-border type-p transition-colors",
                material
                  ? "text-primary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary"
                  : "text-tertiary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary",
              )}
            >
              {material || "Select material"}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]"
          align="start"
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = material === option;
                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => handleSelect(option)}
                        className="justify-between"
                      >
                        <span className="type-p">{option}</span>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4 text-brand" />
                        )}
                      </CommandItem>
                    );
                  })
                ) : searchQuery.trim() ? (
                  <CommandItem
                    value={searchQuery.trim()}
                    onSelect={handleCreate}
                  >
                    <div className="flex items-center">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary px-1">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : (
                  <CommandEmpty>Start typing to create...</CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const CountryTags = ({ countries }: { countries: string[] }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {countries.map((countryCode) => {
        // Look up the full country name from the country code
        const country = countryData[countryCode as keyof typeof countryData];
        const displayName = country?.name || countryCode;

        return (
          <span
            key={countryCode}
            className="px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary"
          >
            {displayName}
          </span>
        );
      })}
    </div>
  );
};

const PercentageCell = ({
  percentage,
  onPercentageChange,
  onDelete,
}: {
  percentage: string;
  onPercentageChange: (value: string) => void;
  onDelete: () => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handlePercentageChange = (value: string) => {
    // Coerce a single "." back to an empty string
    if (value === ".") {
      onPercentageChange("");
      return;
    }
    // Allow empty, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      onPercentageChange(value);
    }
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full-cell input with focus ring */}
      <Input
        type="text"
        value={percentage}
        onChange={(e) => handlePercentageChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Value"
        className="h-full w-full rounded-none border-0 bg-transparent type-p pl-8 pr-10 focus-visible:ring-[1.5px] focus-visible:ring-brand"
      />

      {/* Absolutely positioned % symbol */}
      <span
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 text-tertiary type-p pointer-events-none",
          isFocused && "z-10",
        )}
      >
        %
      </span>

      {/* Absolutely positioned three-dot menu */}
      <div
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2",
          isFocused && "z-10",
        )}
        onClick={handleMenuClick}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "p-1 hover:bg-accent data-[state=open]:bg-accent data-[state=open]:opacity-100 rounded transition-colors",
                isHovered || menuOpen ? "opacity-100" : "opacity-0",
              )}
            >
              <Icons.EllipsisVertical className="h-4 w-4 text-tertiary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={4}
            className="min-w-[120px]"
          >
            <DropdownMenuItem
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              className="text-destructive focus:text-destructive"
            >
              <div className="flex items-center">
                <Icons.X className="h-4 w-4" />
                <span className="px-1">Delete</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

interface MaterialsSectionProps {
  materials: Array<{ materialId: string; percentage: number }>;
  setMaterials: (
    value: Array<{ materialId: string; percentage: number }>,
  ) => void;
  materialsError?: string;
  sectionRef?: React.Ref<HTMLDivElement>;
}

export function MaterialsSection({
  materials: parentMaterials,
  setMaterials: setParentMaterials,
  materialsError,
  sectionRef,
}: MaterialsSectionProps) {
  const { materials: materialOptions } = useBrandCatalog();
  // Local display state (enriched with names and countries from materialOptions)
  const [displayMaterials, setDisplayMaterials] = React.useState<Material[]>(
    [],
  );
  const [materialSheetOpen, setMaterialSheetOpen] = React.useState(false);
  const [materialSheetInitialName, setMaterialSheetInitialName] =
    React.useState("");
  const [creatingForMaterialId, setCreatingForMaterialId] = React.useState<
    string | null
  >(null);
  // Track materials that were just created to preserve them during sync
  const [justCreatedMaterial, setJustCreatedMaterial] = React.useState<{
    id: string;
    name: string;
    countries: string[];
    forTempId: string;
  } | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const justCreatedTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync parent materials with display materials
  // Preserve pending materials (temp IDs) and materials being created
  React.useEffect(() => {
    const enriched: Material[] = parentMaterials
      .map((pm) => {
        const materialInfo = materialOptions.find(
          (m) => m.id === pm.materialId,
        );

        // Skip materials not yet in materialOptions (waiting for refetch)
        if (!materialInfo) {
          return null;
        }

        return {
          id: pm.materialId,
          name: materialInfo.name || "",
          countries: materialInfo.country_of_origin
            ? [materialInfo.country_of_origin]
            : [],
          percentage: pm.percentage === 0 ? "" : pm.percentage.toString(),
        };
      })
      .filter((m): m is Material => m !== null);

    // Preserve pending materials (temp IDs) that aren't in parentMaterials yet
    // Use functional update to read current displayMaterials
    setDisplayMaterials((prev) => {
      const pendingMaterials = prev.filter(
        (m) =>
          m.id.startsWith("temp-") &&
          !parentMaterials.some((pm) => pm.materialId === m.id),
      );

      // Check if we have a just-created material that needs to be preserved
      // This handles the race condition where materialOptions updates before parent sync
      if (justCreatedMaterial) {
        const alreadyInEnriched = enriched.some(
          (m) => m.id === justCreatedMaterial.id,
        );
        const alreadyInPending = pendingMaterials.some(
          (m) => m.id === justCreatedMaterial.id,
        );

        if (!alreadyInEnriched && !alreadyInPending) {
          // Find the percentage from the temp row if it still exists
          const tempRow = prev.find(
            (m) => m.id === justCreatedMaterial.forTempId,
          );
          const percentage = tempRow?.percentage || "";

          return [
            ...enriched,
            ...pendingMaterials,
            {
              id: justCreatedMaterial.id,
              name: justCreatedMaterial.name,
              countries: justCreatedMaterial.countries,
              percentage,
            },
          ];
        }
      }

      return [...enriched, ...pendingMaterials];
    });
  }, [parentMaterials, materialOptions, justCreatedMaterial]);

  // Helper to sync display materials back to parent
  const syncToParent = React.useCallback(
    (displayMats: Material[]) => {
      const parentMats = displayMats
        .filter((m) => m.id && m.name) // Only include materials with ID and name
        .map((m) => {
          const percentageValue = m.percentage.trim();
          if (!percentageValue || percentageValue === ".") {
            return {
              materialId: m.id,
              percentage: 0,
            };
          }
          const parsed = Number.parseFloat(percentageValue);
          // Treat NaN or non-finite values as 0
          const safePercentage = Number.isFinite(parsed) ? parsed : 0;
          return {
            materialId: m.id,
            percentage: safePercentage,
          };
        });
      setParentMaterials(parentMats);
    },
    [setParentMaterials],
  );

  // Debounce syncing to the parent to reduce rerenders during typing
  React.useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncToParent(displayMaterials);
    }, 150);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (justCreatedTimeoutRef.current) {
        clearTimeout(justCreatedTimeoutRef.current);
      }
    };
  }, [displayMaterials, syncToParent]);

  const handleMaterialCreated = (material: any) => {
    if (creatingForMaterialId) {
      const countries = material.countryOfOrigin
        ? [material.countryOfOrigin]
        : [];

      // Track the just-created material to preserve it during sync race conditions
      setJustCreatedMaterial({
        id: material.id,
        name: material.name,
        countries,
        forTempId: creatingForMaterialId,
      });

      // Find the percentage from the temp row
      const tempRow = displayMaterials.find(
        (m) => m.id === creatingForMaterialId,
      );
      const percentage = tempRow?.percentage || "";

      // Directly update displayMaterials with the real material data
      const updatedDisplay = displayMaterials.map((m) => {
        if (m.id === creatingForMaterialId) {
          // Replace temp material with real material data
          return {
            id: material.id,
            name: material.name,
            countries,
            percentage, // Preserve existing percentage
          };
        }
        return m;
      });

      // Update display state immediately
      setDisplayMaterials(updatedDisplay);

      // Immediately sync to parent (bypass debounce) to prevent race condition
      const parentMats = updatedDisplay
        .filter((m) => m.id && m.name && !m.id.startsWith("temp-"))
        .map((m) => {
          const percentageValue = m.percentage.trim();
          if (!percentageValue || percentageValue === ".") {
            return { materialId: m.id, percentage: 0 };
          }
          const parsed = Number.parseFloat(percentageValue);
          const safePercentage = Number.isFinite(parsed) ? parsed : 0;
          return { materialId: m.id, percentage: safePercentage };
        });
      setParentMaterials(parentMats);

      // Clear creating state
      setCreatingForMaterialId(null);

      // Clear justCreatedMaterial after a delay (once sync is stable)
      if (justCreatedTimeoutRef.current) {
        clearTimeout(justCreatedTimeoutRef.current);
      }
      justCreatedTimeoutRef.current = setTimeout(
        () => setJustCreatedMaterial(null),
        500,
      );
    }
  };

  const handleCreateMaterial = (searchTerm: string, materialId: string) => {
    setMaterialSheetInitialName(searchTerm);
    setCreatingForMaterialId(materialId);
    setMaterialSheetOpen(true);
  };

  const updateMaterial = (id: string, field: keyof Material, value: any) => {
    setDisplayMaterials((prev) =>
      prev.map((material) =>
        material.id === id ? { ...material, [field]: value } : material,
      ),
    );
  };

  const deleteMaterial = (id: string) => {
    // If deleting the just-created material, clear the safety net
    // to prevent the useEffect from resurrecting it
    if (justCreatedMaterial?.id === id) {
      setJustCreatedMaterial(null);
      if (justCreatedTimeoutRef.current) {
        clearTimeout(justCreatedTimeoutRef.current);
        justCreatedTimeoutRef.current = null;
      }
    }
    setDisplayMaterials((prev) =>
      prev.filter((material) => material.id !== id),
    );
  };

  const addMaterial = () => {
    const newMaterial: Material = {
      id: `temp-${Date.now()}`, // Temp ID until material is created
      name: "",
      countries: [],
      percentage: "",
    };
    setDisplayMaterials((prev) => [...prev, newMaterial]);
    // Don't sync to parent yet (no real material ID)
  };

  // Calculate totals
  const materialCount = displayMaterials.length;
  const countryCount = new Set(displayMaterials.flatMap((m) => m.countries))
    .size;
  const totalPercentage = displayMaterials.reduce((sum, material) => {
    const percentage = Number.parseFloat(material.percentage) || 0;
    return sum + percentage;
  }, 0);

  return (
    <div
      ref={sectionRef}
      className={cn(
        "relative flex flex-col border border-border bg-background focus:outline-none",
        materialsError &&
        "border-destructive focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive",
      )}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="p-4 flex flex-col gap-1.5">
        <p className="type-p !font-medium text-primary">Materials</p>
        {materialsError && (
          <p className="type-small text-destructive">{materialsError}</p>
        )}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-3">
        <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
          Material
        </div>
        <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
          Country
        </div>
        <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
          Percentage
        </div>
      </div>

      {/* Empty State or Material Rows - min-height with growth */}
      <div className="min-h-[200px]">
        {displayMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-[200px]">
            <p className="type-p text-tertiary">No materials added</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMaterial}
            >
              <Icons.Plus className="h-4 w-4" />
              <span className="px-1">Add material</span>
            </Button>
          </div>
        ) : (
          displayMaterials.map((material) => (
            <div
              key={material.id}
              className="grid grid-cols-3"
            >
              {/* Material Column */}
              <div className="border-r border-b border-border">
                <MaterialDropdown
                  material={material.name}
                  availableMaterials={materialOptions}
                  excludeMaterialIds={displayMaterials
                    .filter((m) => m.id && !m.id.startsWith("temp-"))
                    .map((m) => m.id)}
                  onMaterialChange={(value) => {
                    // Find the selected material to get its real ID
                    const selectedMaterial = materialOptions.find(
                      (m) => m.name === value,
                    );

                    if (selectedMaterial) {
                      // Replace the entire row with the selected material's data
                      setDisplayMaterials((prev) =>
                        prev.map((m) =>
                          m.id === material.id
                            ? {
                              ...m,
                              id: selectedMaterial.id, // Update to real ID
                              name: selectedMaterial.name,
                              countries: selectedMaterial.country_of_origin
                                ? [selectedMaterial.country_of_origin]
                                : [],
                            }
                            : m,
                        ),
                      );
                    }
                  }}
                  onCreateMaterial={(searchTerm) =>
                    handleCreateMaterial(searchTerm, material.id)
                  }
                />
              </div>

              {/* Country Column */}
              <div className="px-2 py-2 border-r border-b border-border flex items-center">
                {material.countries.length > 0 ? (
                  <CountryTags countries={material.countries} />
                ) : (
                  <span className="type-p text-tertiary pl-2">No country</span>
                )}
              </div>

              {/* Percentage Column */}
              <div className="border-b border-border">
                <PercentageCell
                  percentage={material.percentage}
                  onPercentageChange={(value) =>
                    updateMaterial(material.id, "percentage", value)
                  }
                  onDelete={() => deleteMaterial(material.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Row */}
      {displayMaterials.length > 0 && (
        <div className="grid grid-cols-3 border-t border-border -mt-px">
          <div className="bg-background px-4 py-2" />
          <div className="bg-background px-4 py-2" />
          <div className="bg-background px-4 py-2 type-small font-medium flex justify-end items-center gap-[6px]">
            <span
              className={cn(
                totalPercentage > 100 ? "text-destructive" : "text-primary",
              )}
            >
              {totalPercentage}
            </span>
            <span className="text-tertiary font-normal">/</span>
            <span className="text-tertiary font-normal">100 %</span>
          </div>
        </div>
      )}

      {/* Add Material Button - Only show if materials exist */}
      {displayMaterials.length > 0 && (
        <div className="bg-accent-light border-t border-border px-4 py-3 -mt-px">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMaterial}
          >
            <Icons.Plus className="h-4 w-4" />
            <span className="px-1">Add material</span>
          </Button>
        </div>
      )}

      {/* Material Creation Sheet */}
      <MaterialSheet
        open={materialSheetOpen}
        onOpenChange={(open) => {
          setMaterialSheetOpen(open);
          if (!open) {
            // Reset state when sheet closes
            setCreatingForMaterialId(null);
            setMaterialSheetInitialName("");
          }
        }}
        initialName={materialSheetInitialName}
        onMaterialCreated={handleMaterialCreated}
      />
    </div>
  );
}

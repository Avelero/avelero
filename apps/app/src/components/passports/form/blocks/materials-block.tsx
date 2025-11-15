"use client";

import { usePassportFormData } from "@/hooks/use-passport-form-data";
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

  // Filter out materials that are already added
  const filteredMaterials = React.useMemo(() => {
    if (!excludeMaterialIds || excludeMaterialIds.length === 0) {
      return availableMaterials;
    }
    const excludeSet = new Set(excludeMaterialIds);
    return availableMaterials.filter(m => !excludeSet.has(m.id));
  }, [availableMaterials, excludeMaterialIds]);

  const materialNames = React.useMemo(
    () => filteredMaterials.map(m => m.name),
    [filteredMaterials]
  );

  const handleSelect = (selectedMaterial: string) => {
    onMaterialChange(selectedMaterial);
    setDropdownOpen(false);
    setSearchQuery("");
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
                  ? "text-primary group-hover:text-secondary group-hover:border-secondary"
                  : "text-tertiary group-hover:text-secondary group-hover:border-secondary",
              )}
            >
              {material || "Select material"}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search materials..."
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
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : (
                  <CommandEmpty>
                    Start typing to create...
                  </CommandEmpty>
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
      {countries.map((country) => (
        <span
          key={country}
          className="px-2 h-6 flex items-center justify-center border border-border rounded-full bg-background type-small text-primary"
        >
          {country}
        </span>
      ))}
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleCellClick = () => {
    inputRef.current?.focus();
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handlePercentageChange = (value: string) => {
    // Allow empty, numbers, and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onPercentageChange(value);
    }
  };

  return (
    <div
      className="flex items-center justify-between w-full h-full px-4 py-2 cursor-text"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCellClick}
    >
      <div className="flex items-center flex-1 min-w-0">
        <span className="text-tertiary mr-2 type-p">%</span>
        <input
          ref={inputRef}
          type="text"
          value={percentage}
          onChange={(e) => handlePercentageChange(e.target.value)}
          placeholder="Value"
          className="flex-1 type-p text-primary focus:outline-none placeholder:text-tertiary min-w-0 bg-transparent"
        />
      </div>

      <div className="w-6 flex justify-center ml-2" onClick={handleMenuClick}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "p-1 hover:bg-accent transition-colors",
                isHovered ? "opacity-100" : "opacity-0",
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
              <Icons.X className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

interface MaterialsSectionProps {
  materials: Array<{ materialId: string; percentage: number }>;
  setMaterials: (value: Array<{ materialId: string; percentage: number }>) => void;
}

export function MaterialsSection({
  materials: parentMaterials,
  setMaterials: setParentMaterials,
}: MaterialsSectionProps) {
  const { materials: materialOptions } = usePassportFormData();
  // Local display state (enriched with names and countries from materialOptions)
  const [displayMaterials, setDisplayMaterials] = React.useState<Material[]>([]);
  const [materialSheetOpen, setMaterialSheetOpen] = React.useState(false);
  const [materialSheetInitialName, setMaterialSheetInitialName] =
    React.useState("");
  const [creatingForMaterialId, setCreatingForMaterialId] = React.useState<
    string | null
  >(null);
  
  // Sync parent materials with display materials
  React.useEffect(() => {
    const enriched: Material[] = parentMaterials
      .map(pm => {
        const materialInfo = materialOptions.find(m => m.id === pm.materialId);
        
        // Skip materials not yet in materialOptions (waiting for refetch)
        if (!materialInfo) {
          return null;
        }
        
        return {
          id: pm.materialId,
          name: materialInfo.name || "",
          countries: materialInfo.country_of_origin ? [materialInfo.country_of_origin] : [],
          percentage: pm.percentage === 0 ? "" : pm.percentage.toString(),
        };
      })
      .filter((m): m is Material => m !== null);
      
    setDisplayMaterials(enriched);
  }, [parentMaterials, materialOptions]);

  // Helper to sync display materials back to parent
  const syncToParent = (displayMats: Material[]) => {
    const parentMats = displayMats
      .filter(m => m.id && m.name) // Only include materials with ID and name
      .map(m => {
        const percentageValue = m.percentage.trim();
        return {
          materialId: m.id,
          percentage: percentageValue ? Number.parseFloat(percentageValue) : 0,
        };
      });
    setParentMaterials(parentMats);
  };

  const handleMaterialCreated = (material: any) => {
    if (creatingForMaterialId) {
      // Directly update displayMaterials with the real material data
      // This avoids complex state sync and timing dependencies
      const updatedDisplay = displayMaterials.map((m) => {
        if (m.id === creatingForMaterialId) {
          // Replace temp material with real material data
          return {
            id: material.id,
            name: material.name,
            countries: material.countryOfOrigin ? [material.countryOfOrigin] : [],
            percentage: m.percentage, // Preserve existing percentage
          };
        }
        return m;
      });
      
      // Update display state immediately
      setDisplayMaterials(updatedDisplay);
      
      // Sync to parent state
      syncToParent(updatedDisplay);
      
      // Clear creating state
      setCreatingForMaterialId(null);
    }
  };

  const handleCreateMaterial = (searchTerm: string, materialId: string) => {
    setMaterialSheetInitialName(searchTerm);
    setCreatingForMaterialId(materialId);
    setMaterialSheetOpen(true);
  };

  const updateMaterial = (id: string, field: keyof Material, value: any) => {
    const updatedDisplay = displayMaterials.map((material) =>
      material.id === id ? { ...material, [field]: value } : material,
    );
    setDisplayMaterials(updatedDisplay);
    syncToParent(updatedDisplay);
  };

  const deleteMaterial = (id: string) => {
    const updatedDisplay = displayMaterials.filter((material) => material.id !== id);
    setDisplayMaterials(updatedDisplay);
    syncToParent(updatedDisplay);
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
  const countryCount = new Set(displayMaterials.flatMap((m) => m.countries)).size;
  const totalPercentage = displayMaterials.reduce((sum, material) => {
    const percentage = Number.parseFloat(material.percentage) || 0;
    return sum + percentage;
  }, 0);

  return (
    <div className="relative flex flex-col border border-border bg-background">
      {/* Header */}
      <div className="p-4">
        <p className="type-p !font-medium text-primary">Materials</p>
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

      {/* Empty State or Material Rows - with fixed height and scroll */}
      <div className="h-[200px] overflow-y-auto scrollbar-hide">
        {displayMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <p className="type-p text-tertiary">No materials added</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMaterial}
              icon={<Icons.Plus className="h-4 w-4" />}
              iconPosition="left"
            >
              Add material
            </Button>
          </div>
        ) : (
          displayMaterials.map((material) => (
            <div key={material.id} className="grid grid-cols-3">
              {/* Material Column */}
              <div className="border-r border-b border-border">
                <MaterialDropdown
                  material={material.name}
                  availableMaterials={materialOptions}
                  excludeMaterialIds={displayMaterials
                    .filter(m => m.id && !m.id.startsWith('temp-'))
                    .map(m => m.id)}
                  onMaterialChange={(value) => {
                    // Find the selected material to get its real ID
                    const selectedMaterial = materialOptions.find(m => m.name === value);
                    
                    if (selectedMaterial) {
                      // Replace the entire row with the selected material's data
                      const updatedDisplay = displayMaterials.map((m) =>
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
                      );
                      setDisplayMaterials(updatedDisplay);
                      syncToParent(updatedDisplay);
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
        <div className="grid grid-cols-3 -mt-px">
          <div className="bg-background px-4 py-2 border-t border-b border-border" />
          <div className="bg-background px-4 py-2 border-t border-b border-border" />
          <div className="bg-background px-4 py-2 type-small font-medium flex justify-end items-center gap-[6px] border-t border-b border-border">
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
            icon={<Icons.Plus className="h-4 w-4" />}
            iconPosition="left"
          >
            Add material
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

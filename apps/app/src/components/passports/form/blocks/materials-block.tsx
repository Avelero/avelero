"use client";

import * as React from "react";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@v1/ui/dropdown-menu";
import { cn } from "@v1/ui/cn";

interface Material {
  id: string;
  name: string;
  countries: string[];
  percentage: string;
}

// TODO: Load from API
const MATERIAL_OPTIONS = [
  "Recycled Polyester",
  "Organic Cotton",
  "Wool",
  "Linen",
  "Silk",
  "Bamboo",
  "Hemp",
  "Tencel",
];

const MaterialDropdown = ({
  material,
  onMaterialChange,
}: {
  material: string;
  onMaterialChange: (material: string) => void;
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSelect = (selectedMaterial: string) => {
    onMaterialChange(selectedMaterial);
    setDropdownOpen(false);
    setSearchQuery("");
  };

  const handleCreate = () => {
    if (searchQuery && !MATERIAL_OPTIONS.includes(searchQuery)) {
      // TODO: Open material sheet for creation
      onMaterialChange(searchQuery);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  };

  const filteredOptions = MATERIAL_OPTIONS.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex items-center w-full h-full px-4 py-2">
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              "border-b border-border type-p cursor-pointer transition-colors",
              material 
                ? "text-primary hover:text-secondary hover:border-secondary" 
                : "text-tertiary hover:text-secondary hover:border-secondary"
            )}
          >
            {material || "Select material"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64" align="start" sideOffset={4}>
          <Command>
            <CommandInput
              placeholder="Search materials..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No materials found.</CommandEmpty>
              {(!searchQuery || filteredOptions.length > 0) && (
                <CommandGroup>
                  {filteredOptions.map((option) => {
                    const isSelected = material === option;
                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => handleSelect(option)}
                        className="justify-between"
                      >
                        <span className="type-p">{option}</span>
                        {isSelected && <Icons.Check className="h-4 w-4 text-brand" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
            {searchQuery && !MATERIAL_OPTIONS.includes(searchQuery) && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full flex items-center justify-start py-2 px-3 bg-background hover:bg-accent transition-colors"
                >
                  <span className="type-p text-primary">Create "{searchQuery}"</span>
                </button>
              </div>
            )}
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
          onChange={(e) => onPercentageChange(e.target.value)}
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
                isHovered ? "opacity-100" : "opacity-0"
              )}
            >
              <Icons.EllipsisVertical className="h-4 w-4 text-tertiary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-[120px]">
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

export function MaterialsSection() {
  const [materials, setMaterials] = React.useState<Material[]>([]);

  const updateMaterial = (id: string, field: keyof Material, value: any) => {
    setMaterials((prev) =>
      prev.map((material) => (material.id === id ? { ...material, [field]: value } : material))
    );
  };

  const deleteMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  };

  const addMaterial = () => {
    const newMaterial: Material = {
      id: Date.now().toString(),
      name: "",
      countries: [],
      percentage: "",
    };
    setMaterials((prev) => [...prev, newMaterial]);
  };

  // Calculate totals
  const materialCount = materials.length;
  const countryCount = new Set(materials.flatMap((m) => m.countries)).size;
  const totalPercentage = materials.reduce((sum, material) => {
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
        {materials.length === 0 ? (
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
          materials.map((material) => (
            <div key={material.id} className="grid grid-cols-3">
              {/* Material Column */}
              <div className="border-r border-b border-border">
                <MaterialDropdown
                  material={material.name}
                  onMaterialChange={(value) => {
                updateMaterial(material.id, "name", value);
                // Mock: Set countries based on material selection
                if (value === "Recycled Polyester") {
                  updateMaterial(material.id, "countries", ["China"]);
                } else if (value === "Organic Cotton") {
                  updateMaterial(material.id, "countries", ["Portugal"]);
                } else if (value === "Wool") {
                  updateMaterial(material.id, "countries", ["India"]);
                } else {
                  updateMaterial(material.id, "countries", []);
                }
                  }}
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
                  onPercentageChange={(value) => updateMaterial(material.id, "percentage", value)}
                  onDelete={() => deleteMaterial(material.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Row */}
      {materials.length > 0 && (
        <div className="grid grid-cols-3 -mt-px">
          <div className="bg-background px-4 py-2 border-t border-b border-border" />
          <div className="bg-background px-4 py-2 border-t border-b border-border" />
          <div className="bg-background px-4 py-2 type-small font-medium flex justify-end items-center gap-[6px] border-t border-b border-border">
            <span className={cn(totalPercentage > 100 ? "text-destructive" : "text-primary")}>
              {totalPercentage}
            </span>
            <span className="text-tertiary font-normal">/</span>
            <span className="text-tertiary font-normal">100 %</span>
          </div>
        </div>
      )}

      {/* Add Material Button - Only show if materials exist */}
      {materials.length > 0 && (
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
    </div>
  );
}

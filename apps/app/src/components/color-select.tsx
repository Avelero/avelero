"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

export interface ColorOption {
  name: string;
  hex: string; // Without the # prefix
}

interface ColorSelectProps {
  value: ColorOption[];
  onValueChange: (value: ColorOption[]) => void;
  defaultColors: ColorOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Tailwind color palette
const TAILWIND_COLORS = [
  { name: "Red", shades: ["FEE2E2", "FECACA", "FCA5A5", "F87171", "EF4444", "DC2626", "B91C1C", "991B1B", "7F1D1D", "7F1D1D"] },
  { name: "Orange", shades: ["FFEDD5", "FED7AA", "FDBA74", "FB923C", "F97316", "EA580C", "C2410C", "9A3412", "7C2D12", "7C2D12"] },
  { name: "Amber", shades: ["FEF3C7", "FDE68A", "FCD34D", "FBBF24", "F59E0B", "D97706", "B45309", "92400E", "78350F", "78350F"] },
  { name: "Yellow", shades: ["FEF9C3", "FEF08A", "FDE047", "FACC15", "EAB308", "CA8A04", "A16207", "854D0E", "713F12", "713F12"] },
  { name: "Lime", shades: ["ECFCCB", "D9F99D", "BEF264", "A3E635", "84CC16", "65A30D", "4D7C0F", "3F6212", "365314", "365314"] },
  { name: "Green", shades: ["D1FAE5", "A7F3D0", "6EE7B7", "34D399", "10B981", "059669", "047857", "065F46", "064E3B", "064E3B"] },
  { name: "Emerald", shades: ["D1FAE5", "A7F3D0", "6EE7B7", "34D399", "10B981", "059669", "047857", "065F46", "064E3B", "064E3B"] },
  { name: "Teal", shades: ["CCFBF1", "99F6E4", "5EEAD4", "2DD4BF", "14B8A6", "0D9488", "0F766E", "115E59", "134E4A", "134E4A"] },
  { name: "Cyan", shades: ["CFFAFE", "A5F3FC", "67E8F9", "22D3EE", "06B6D4", "0891B2", "0E7490", "155E75", "164E63", "164E63"] },
  { name: "Sky", shades: ["E0F2FE", "BAE6FD", "7DD3FC", "38BDF8", "0EA5E9", "0284C7", "0369A1", "075985", "0C4A6E", "0C4A6E"] },
  { name: "Blue", shades: ["DBEAFE", "BFDBFE", "93C5FD", "60A5FA", "3B82F6", "2563EB", "1D4ED8", "1E40AF", "1E3A8A", "1E3A8A"] },
  { name: "Indigo", shades: ["E0E7FF", "C7D2FE", "A5B4FC", "818CF8", "6366F1", "4F46E5", "4338CA", "3730A3", "312E81", "312E81"] },
  { name: "Violet", shades: ["EDE9FE", "DDD6FE", "C4B5FD", "A78BFA", "8B5CF6", "7C3AED", "6D28D9", "5B21B6", "4C1D95", "4C1D95"] },
  { name: "Purple", shades: ["F3E8FF", "E9D5FF", "D8B4FE", "C084FC", "A855F7", "9333EA", "7E22CE", "6B21A8", "581C87", "581C87"] },
  { name: "Fuchsia", shades: ["FAE8FF", "F5D0FE", "F0ABFC", "E879F9", "D946EF", "C026D3", "A21CAF", "86198F", "701A75", "701A75"] },
  { name: "Pink", shades: ["FCE7F3", "FBCFE8", "F9A8D4", "F472B6", "EC4899", "DB2777", "BE185D", "9D174D", "831843", "831843"] },
  { name: "Rose", shades: ["FFE4E6", "FECDD3", "FDA4AF", "FB7185", "F43F5E", "E11D48", "BE123C", "9F1239", "881337", "881337"] },
  { name: "Stone", shades: ["F5F5F4", "E7E5E4", "D6D3D1", "A8A29E", "78716C", "57534E", "44403C", "292524", "1C1917", "1C1917"] },
  { name: "Zinc", shades: ["F4F4F5", "E4E4E7", "D4D4D8", "A1A1AA", "71717A", "52525B", "3F3F46", "27272A", "18181B", "18181B"] },
  { name: "Gray", shades: ["F3F4F6", "E5E7EB", "D1D5DB", "9CA3AF", "6B7280", "4B5563", "374151", "1F2937", "111827", "111827"] },
  { name: "Slate", shades: ["F1F5F9", "E2E8F0", "CBD5E1", "94A3B8", "64748B", "475569", "334155", "1E293B", "0F172A", "0F172A"] },
];

const SHADE_LABELS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

const ColorLabel = ({ 
  color, 
  onRemove 
}: { 
  color: ColorOption; 
  onRemove: () => void;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className="relative flex items-center justify-center px-2 h-6 border border-border rounded-full bg-background box-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-center h-[12px] w-[12px]">
        <div
            className="h-2.5     w-2.5 rounded-full border-[0.5px] border-border "
            style={{ backgroundColor: `#${color.hex}` }}
        />
      </div>
      <p className="type-small leading-none text-primary ml-1.5">{color.name}</p>
      {isHovered && (
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-3 h-3 bg-gradient-to-r from-transparent to-background" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-4 h-4 flex rounded-r-full rounded-l-md items-center justify-center bg-background text-tertiary hover:text-destructive transition-colors"
          >
            <Icons.X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export function ColorSelect({
  value,
  onValueChange,
  defaultColors,
  placeholder = "Add color",
  disabled = false,
  className,
}: ColorSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [view, setView] = React.useState<"main" | "picker">("main");
  const [pendingColorName, setPendingColorName] = React.useState("");

  const handleToggleColor = (color: ColorOption) => {
    const isSelected = value.some(c => c.name === color.name);
    if (isSelected) {
      onValueChange(value.filter(c => c.name !== color.name));
    } else {
      onValueChange([...value, color]);
    }
  };

  const handleRemoveColor = (colorName: string) => {
    onValueChange(value.filter(c => c.name !== colorName));
  };

  const handleCreateClick = () => {
    if (searchTerm) {
      setPendingColorName(searchTerm);
      setView("picker");
      setSearchTerm("");
    }
  };

  const handleColorPick = (hex: string, shadeName: string) => {
    const newColor: ColorOption = {
      name: pendingColorName,
      hex: hex,
    };
    onValueChange([...value, newColor]);
    setView("main");
    setPendingColorName("");
    setOpen(false);
  };

  const filteredColors = React.useMemo(() => {
    if (!searchTerm) return defaultColors;
    return defaultColors.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [defaultColors, searchTerm]);

  const filteredTailwindColors = React.useMemo(() => {
    if (!searchTerm) return TAILWIND_COLORS;
    return TAILWIND_COLORS.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const showCreateOption = searchTerm && 
    !defaultColors.some(c => c.name.toLowerCase() === searchTerm.toLowerCase()) &&
    !value.some(c => c.name.toLowerCase() === searchTerm.toLowerCase());

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      setView("main");
      setSearchTerm("");
      setPendingColorName("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "flex flex-wrap items-center py-[5px] px-2 w-full min-h-9 border border-border bg-background gap-1.5",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {value.map((color) => (
            <ColorLabel
              key={color.name}
              color={color}
              onRemove={() => handleRemoveColor(color.name)}
            />
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              className="mx-1 border-b border-border type-p text-tertiary hover:text-secondary hover:border-secondary cursor-pointer transition-colors"
            >
              {placeholder}
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-60 p-0" 
        align="start"
      >
        {view === "main" ? (
          <Command>
            <CommandInput
              placeholder="Search colors..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandGroup>
                {filteredColors.length > 0 ? (
                  filteredColors.map((color) => {
                    const isSelected = value.some(c => c.name === color.name);
                    return (
                      <CommandItem
                        key={color.name}
                        value={color.name}
                        onSelect={() => handleToggleColor(color)}
                        className="justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3.5 w-3.5 rounded-full border border-border"
                            style={{ backgroundColor: `#${color.hex}` }}
                          />
                          <span className="type-p text-primary">{color.name}</span>
                        </div>
                        {isSelected && (
                          <Icons.Check className="h-4 w-4" />
                        )}
                      </CommandItem>
                    );
                  })
                ) : searchTerm && showCreateOption ? (
                  <CommandItem
                    value={searchTerm}
                    onSelect={handleCreateClick}
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchTerm}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : !searchTerm ? (
                  <div className="px-3 py-8 text-center">
                    <p className="type-p text-tertiary">
                      Begin typing to create your first color
                    </p>
                  </div>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command>
            <CommandInput
              placeholder="Select a color icon..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandGroup>
                {filteredTailwindColors.map((colorFamily) =>
                  colorFamily.shades.map((hex, index) => (
                    <CommandItem
                      key={`${colorFamily.name}-${SHADE_LABELS[index]}`}
                      value={`${colorFamily.name} ${SHADE_LABELS[index]}`}
                      onSelect={() => handleColorPick(hex, `${colorFamily.name} ${SHADE_LABELS[index]}`)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3.5 w-3.5 rounded-full border border-border"
                          style={{ backgroundColor: `#${hex}` }}
                        />
                        <span className="type-p text-primary">
                          {colorFamily.name} {SHADE_LABELS[index]}
                        </span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}


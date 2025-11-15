"use client";

import { usePassportFormData } from "@/hooks/use-passport-form-data";
import { SHADE_LABELS, colorFamilies } from "@v1/selections";
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
import * as React from "react";

export interface ColorOption {
  name: string;
  hex: string; // Without the # prefix
}

interface ColorSelectProps {
  value: ColorOption[];
  onValueChange: (value: ColorOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ColorLabel = ({
  color,
  onRemove,
  disabled = false,
}: {
  color: ColorOption;
  onRemove: () => void;
  disabled?: boolean;
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
      <p className="type-small leading-none text-primary ml-1.5">
        {color.name}
      </p>
      {isHovered && !disabled && (
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
  placeholder = "Add color",
  disabled = false,
  className,
}: ColorSelectProps) {
  const { colors: defaultColors } = usePassportFormData();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [view, setView] = React.useState<"main" | "picker">("main");
  const [pendingColorName, setPendingColorName] = React.useState("");

  const handleToggleColor = (color: ColorOption) => {
    const isSelected = value.some((c) => c.name === color.name);
    if (isSelected) {
      onValueChange(value.filter((c) => c.name !== color.name));
    } else {
      onValueChange([...value, color]);
    }
  };

  const handleRemoveColor = (colorName: string) => {
    onValueChange(value.filter((c) => c.name !== colorName));
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
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [defaultColors, searchTerm]);

  const filteredColorFamilies = React.useMemo(() => {
    if (!searchTerm) return colorFamilies;
    return colorFamilies.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  const showCreateOption =
    searchTerm &&
    !defaultColors.some(
      (c) => c.name.toLowerCase() === searchTerm.toLowerCase(),
    ) &&
    !value.some((c) => c.name.toLowerCase() === searchTerm.toLowerCase());

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      setView("main");
      setSearchTerm("");
      setPendingColorName("");
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return;
    setOpen(newOpen);
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          className={cn(
            "flex flex-wrap items-center py-[5px] px-2 w-full min-h-9 border border-border bg-background gap-1.5",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          onClick={(e) => {
            if (disabled) e.preventDefault();
          }}
        >
          {value.map((color) => (
            <ColorLabel
              key={color.name}
              color={color}
              onRemove={() => handleRemoveColor(color.name)}
              disabled={disabled}
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
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0" align="start">
        {view === "main" ? (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search colors..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredColors.length > 0 ? (
                  filteredColors.map((color) => {
                    const isSelected = value.some((c) => c.name === color.name);
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
                          <span className="type-p text-primary">
                            {color.name}
                          </span>
                        </div>
                        {isSelected && <Icons.Check className="h-4 w-4" />}
                      </CommandItem>
                    );
                  })
                ) : searchTerm && showCreateOption ? (
                  <CommandItem value={searchTerm} onSelect={handleCreateClick}>
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchTerm}&quot;
                      </span>
                    </div>
                  </CommandItem>
                ) : !searchTerm ? (
                  <CommandEmpty>
                    Start typing to create...
                  </CommandEmpty>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Select a color icon..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredColorFamilies.map((colorFamily) =>
                  colorFamily.shades.map((hex, index) => (
                    <CommandItem
                      key={`${colorFamily.name}-${SHADE_LABELS[index]}`}
                      value={`${colorFamily.name} ${SHADE_LABELS[index]}`}
                      onSelect={() =>
                        handleColorPick(
                          hex,
                          `${colorFamily.name} ${SHADE_LABELS[index]}`,
                        )
                      }
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
                  )),
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

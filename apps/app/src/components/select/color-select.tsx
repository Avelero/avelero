"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@v1/ui/sonner";
import * as React from "react";

export interface ColorOption {
  id?: string;
  name: string;
  hex: string; // Without the # prefix
}

const getColorKey = (color: ColorOption) =>
  color.id && color.id.length > 0 ? color.id : color.name.trim().toLowerCase();

const normalizeHexInput = (hex: string) =>
  hex.replace("#", "").trim().toUpperCase();

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { colors: catalogColors } = useBrandCatalog();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [view, setView] = React.useState<"main" | "picker">("main");
  const [pendingColorName, setPendingColorName] = React.useState("");

  // API mutation for creating color
  const createColorMutation = useMutation(
    trpc.brand.colors.create.mutationOptions(),
  );

  const handleToggleColor = (color: ColorOption) => {
    const targetKey = getColorKey(color);
    const isSelected = value.some((c) => getColorKey(c) === targetKey);
    if (isSelected) {
      onValueChange(value.filter((c) => getColorKey(c) !== targetKey));
    } else {
      onValueChange([...value, color]);
    }
  };

  const handleRemoveColor = (colorToRemove: ColorOption) => {
    const targetKey = getColorKey(colorToRemove);
    onValueChange(value.filter((c) => getColorKey(c) !== targetKey));
  };

  const handleCreateClick = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      setPendingColorName(trimmed);
      setView("picker");
      setSearchTerm("");
    }
  };

  const handleColorPick = async (hex: string) => {
    const colorName = pendingColorName.trim();
    if (!colorName || createColorMutation.isPending) {
      return;
    }

    const normalizedHex = normalizeHexInput(hex);

    try {
      const result = await toast.loading(
        "Creating color...",
        createColorMutation.mutateAsync({
          name: colorName,
          hex: normalizedHex,
        }),
        {
          delay: 200,
          successMessage: `Color "${colorName}" created`,
        },
      );

      const createdColor = result?.data;
      if (!createdColor?.id) {
        throw new Error("No valid response returned from API");
      }

      const newColor: ColorOption = {
        id: createdColor.id,
        name: createdColor.name,
        hex: (createdColor.hex ?? normalizedHex).replace("#", "").toUpperCase(),
      };

      // Optimistically update the cache immediately
      queryClient.setQueryData(
        trpc.composite.brandCatalogContent.queryKey(),
        (old: any) => {
          if (!old?.brandCatalog) return old;
          const existingColors = old.brandCatalog.colors ?? [];
          const alreadyExists = existingColors.some(
            (c: any) => c.name?.toLowerCase() === colorName.toLowerCase(),
          );
          if (alreadyExists) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              colors: [...existingColors, newColor],
            },
          };
        },
      );

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.brandCatalogContent.queryKey(),
      });

      // Add to selection with real ID
      const targetKey = getColorKey(newColor);
      const exists = value.some((c) => getColorKey(c) === targetKey);
      if (!exists) {
        onValueChange([...value, newColor]);
      }

      setView("main");
      setPendingColorName("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to create color:", error);
      toast.error("Failed to create color. Please try again.");
    }
  };

  const filteredColors = React.useMemo(() => {
    if (!searchTerm) return catalogColors;
    return catalogColors.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [catalogColors, searchTerm]);

  const filteredColorFamilies = React.useMemo(() => {
    if (!searchTerm) return colorFamilies;
    return colorFamilies.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const showCreateOption =
    !!normalizedSearch &&
    !catalogColors.some((c) => c.name.toLowerCase() === normalizedSearch) &&
    !value.some((c) => c.name.toLowerCase() === normalizedSearch);

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
            "group flex flex-wrap items-center py-[5px] px-2 w-full min-h-9 border border-border bg-background gap-1.5 cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          onClick={(e) => {
            if (disabled) e.preventDefault();
          }}
        >
          {value.map((color) => (
            <ColorLabel
              key={color.id ?? color.name}
              color={color}
              onRemove={() => handleRemoveColor(color)}
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
              className="mx-1 border-b border-border type-p text-tertiary group-hover:text-secondary group-hover:border-secondary cursor-pointer transition-colors"
            >
              {placeholder}
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0"
        align="start"
      >
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
                    const colorKey = getColorKey(color);
                    const isSelected = value.some(
                      (c) => getColorKey(c) === colorKey,
                    );
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
                  <CommandEmpty>Start typing to create...</CommandEmpty>
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
                      onSelect={() => handleColorPick(hex)}
                      disabled={createColorMutation.isPending}
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

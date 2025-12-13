"use client";

import {
  useBrandCatalog,
  type BrandTagOption,
} from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { allColors } from "@v1/selections";
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

export interface TagOption extends BrandTagOption {}

interface TagSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TagLabel = ({
  tag,
  onRemove,
  disabled = false,
}: {
  tag: TagOption;
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
          className="h-2.5 w-2.5 rounded-full border-[0.5px] border-border"
          style={{ backgroundColor: `#${tag.hex}` }}
        />
      </div>
      <p className="type-small leading-none text-primary ml-1.5">{tag.name}</p>
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

export function TagSelect({
  value,
  onValueChange,
  placeholder = "Add tags",
  disabled = false,
  className,
}: TagSelectProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { tags: catalogTags } = useBrandCatalog();
  const [localTags, setLocalTags] = React.useState<BrandTagOption[]>([]);

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [view, setView] = React.useState<"main" | "picker">("main");
  const [pendingTagName, setPendingTagName] = React.useState("");

  const createTagMutation = useMutation(
    trpc.catalog.tags.create.mutationOptions(),
  );

  const mergedTags = React.useMemo(() => {
    const map = new Map<string, BrandTagOption>();
    for (const tag of catalogTags) {
      map.set(tag.id, tag);
    }
    for (const tag of localTags) {
      if (!map.has(tag.id)) {
        map.set(tag.id, tag);
      }
    }
    return Array.from(map.values());
  }, [catalogTags, localTags]);

  const selectedTagOptions = React.useMemo(() => {
    const tagMap = new Map(mergedTags.map((tag) => [tag.id, tag]));
    return value.map((tagId) => {
      const existing = tagMap.get(tagId);
      if (existing) return existing;
      return { id: tagId, name: tagId, hex: "000000" };
    });
  }, [mergedTags, value]);

  const normalizedSelected = React.useMemo(() => new Set(value), [value]);

  const filteredTags = React.useMemo(() => {
    if (!searchTerm) return mergedTags;
    const normalized = searchTerm.toLowerCase();
    return mergedTags.filter((tag) =>
      tag.name.toLowerCase().includes(normalized),
    );
  }, [mergedTags, searchTerm]);

  const filteredColors = React.useMemo(() => {
    if (!searchTerm) return allColors;
    const normalized = searchTerm.toLowerCase();
    return allColors.filter((color) =>
      color.name.toLowerCase().includes(normalized),
    );
  }, [searchTerm]);

  const showCreateOption =
    !!searchTerm &&
    !catalogTags.some(
      (tag) => tag.name.toLowerCase() === searchTerm.trim().toLowerCase(),
    );

  const handleRemoveTag = (tagId: string) => {
    onValueChange(value.filter((id) => id !== tagId));
  };

  const handleToggleTag = (tagId: string) => {
    if (normalizedSelected.has(tagId)) {
      handleRemoveTag(tagId);
    } else {
      onValueChange([...value, tagId]);
    }
  };

  const handleCreateClick = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      setPendingTagName(trimmed);
      setView("picker");
      setSearchTerm("");
    }
  };

  const handleColorPick = async (color: { name: string; hex: string }) => {
    if (!pendingTagName || createTagMutation.isPending) {
      return;
    }
    const trimmedName = pendingTagName.trim();
    if (!trimmedName) {
      return;
    }

    const hexValue = color.hex.toUpperCase();

    try {
      const result = await toast.loading(
        "Creating tag...",
        createTagMutation.mutateAsync({
          name: trimmedName,
          hex: hexValue,
        }),
        {
          delay: 200,
          successMessage: "Tag created successfully",
        },
      );

      const createdTag = result?.data;
      const optimisticTag = {
        id: createdTag?.id ?? `temp-${Date.now()}`,
        name: trimmedName,
        hex: hexValue,
        created_at: createdTag?.created_at ?? new Date().toISOString(),
        updated_at: createdTag?.updated_at ?? new Date().toISOString(),
      };

      setLocalTags((prev) => [
        ...prev,
        {
          id: optimisticTag.id,
          name: optimisticTag.name,
          hex: optimisticTag.hex,
        },
      ]);

      queryClient.setQueryData(
        trpc.composite.catalogContent.queryKey(),
        (old: any) => {
          if (!old?.brandCatalog) return old;
          const existingTags = old.brandCatalog.tags ?? [];
          const alreadyExists = existingTags.some(
            (tag: any) => tag.name?.toLowerCase() === trimmedName.toLowerCase(),
          );
          if (alreadyExists) {
            return old;
          }
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              tags: [...existingTags, optimisticTag],
            },
          };
        },
      );

      queryClient.invalidateQueries({
        queryKey: trpc.composite.catalogContent.queryKey(),
      });

      onValueChange([...new Set([...value, optimisticTag.id])]);
      setView("main");
      setPendingTagName("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
      toast.error("Failed to create tag. Please try again.");
    }
  };

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      setView("main");
      setSearchTerm("");
      setPendingTagName("");
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
          {selectedTagOptions.map((tag) => (
            <TagLabel
              key={tag.id}
              tag={tag}
              onRemove={() => handleRemoveTag(tag.id)}
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
              placeholder="Search or create tags..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredTags.length > 0 &&
                  filteredTags.map((tag) => {
                    const isSelected = normalizedSelected.has(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => handleToggleTag(tag.id)}
                        className="justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3.5 w-3.5 rounded-full border border-border"
                            style={{ backgroundColor: `#${tag.hex}` }}
                          />
                          <span className="type-p text-primary">
                            {tag.name}
                          </span>
                        </div>
                        {isSelected && <Icons.Check className="h-4 w-4" />}
                      </CommandItem>
                    );
                  })}
                {filteredTags.length === 0 && showCreateOption && (
                  <CommandItem value={searchTerm} onSelect={handleCreateClick}>
                    <div className="flex items-center gap-2">
                      <Icons.Plus className="h-3.5 w-3.5" />
                      <span className="type-p text-primary">
                        Create &quot;{searchTerm.trim()}&quot;
                      </span>
                    </div>
                  </CommandItem>
                )}
                {filteredTags.length === 0 && !showCreateOption && (
                  <CommandEmpty>
                    {searchTerm ? "No tags found" : "No tags yet"}
                  </CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Select a color..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filteredColors.map((color) => (
                  <CommandItem
                    key={color.name}
                    value={color.name}
                    onSelect={() => handleColorPick(color)}
                    disabled={createTagMutation.isPending}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3.5 w-3.5 rounded-full border border-border"
                        style={{ backgroundColor: `#${color.hex}` }}
                      />
                      <span className="type-p text-primary">{color.name}</span>
                    </div>
                  </CommandItem>
                ))}
                {filteredColors.length === 0 && (
                  <CommandEmpty>No colors found</CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

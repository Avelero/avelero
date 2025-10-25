"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

export interface TagOption {
  name: string;
  hex: string; // Without the # prefix
}

interface TagSelectProps {
  value: TagOption[];
  onValueChange: (value: TagOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Tailwind core colors at 500 shade
const TAG_COLORS = [
  { name: "Red", hex: "EF4444" },
  { name: "Orange", hex: "F97316" },
  { name: "Yellow", hex: "EAB308" },
  { name: "Lime", hex: "84CC16" },
  { name: "Green", hex: "10B981" },
  { name: "Teal", hex: "14B8A6" },
  { name: "Cyan", hex: "06B6D4" },
  { name: "Blue", hex: "3B82F6" },
  { name: "Violet", hex: "8B5CF6" },
  { name: "Purple", hex: "A855F7" },
  { name: "Pink", hex: "EC4899" },
  { name: "Gray", hex: "6B7280" },
  { name: "Stone", hex: "78716C" },
];

const TagLabel = ({ 
  tag, 
  onRemove 
}: { 
  tag: TagOption; 
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
            className="h-2.5 w-2.5 rounded-full border-[0.5px] border-border"
            style={{ backgroundColor: `#${tag.hex}` }}
        />
      </div>
      <p className="type-small leading-none text-primary ml-1.5">{tag.name}</p>
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

/**
 * A multi-select tag input that displays selected tags and lets users remove existing tags,
 * search available tags, or create a new tag by name and assign it a color via a color picker.
 *
 * @param value - Array of currently selected tag options.
 * @param onValueChange - Callback invoked with the updated tag array when tags are added or removed.
 * @param placeholder - Text shown in the trigger when there is space to add tags; defaults to `"Add tags"`.
 * @param disabled - When `true`, interaction is disabled and the control is visually dimmed; defaults to `false`.
 * @param className - Optional additional CSS class names applied to the trigger container.
 * @returns The TagSelect React element.
 */
export function TagSelect({
  value,
  onValueChange,
  placeholder = "Add tags",
  disabled = false,
  className,
}: TagSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [view, setView] = React.useState<"main" | "picker">("main");
  const [pendingTagName, setPendingTagName] = React.useState("");

  const handleRemoveTag = (tagName: string) => {
    onValueChange(value.filter(t => t.name !== tagName));
  };

  const handleCreateClick = () => {
    if (searchTerm) {
      setPendingTagName(searchTerm);
      setView("picker");
      setSearchTerm("");
    }
  };

  const handleColorPick = (color: { name: string; hex: string }) => {
    const newTag: TagOption = {
      name: pendingTagName,
      hex: color.hex,
    };
    onValueChange([...value, newTag]);
    setView("main");
    setPendingTagName("");
    setOpen(false);
  };

  const filteredTags = React.useMemo(() => {
    if (!searchTerm) return value;
    return value.filter((t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [value, searchTerm]);

  const filteredColors = React.useMemo(() => {
    if (!searchTerm) return TAG_COLORS;
    return TAG_COLORS.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const showCreateOption = searchTerm && 
    !value.some(t => t.name.toLowerCase() === searchTerm.toLowerCase());

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      setView("main");
      setSearchTerm("");
      setPendingTagName("");
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
          {value.map((tag) => (
            <TagLabel
              key={tag.name}
              tag={tag}
              onRemove={() => handleRemoveTag(tag.name)}
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
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tags..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandGroup>
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag) => (
                    <CommandItem
                      key={tag.name}
                      value={tag.name}
                      onSelect={() => handleRemoveTag(tag.name)}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3.5 w-3.5 rounded-full border border-border"
                          style={{ backgroundColor: `#${tag.hex}` }}
                        />
                        <span className="type-p text-primary">{tag.name}</span>
                      </div>
                      <Icons.Check className="h-4 w-4" />
                    </CommandItem>
                  ))
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
                      Begin typing to create your first tag
                    </p>
                  </div>
                ) : null}
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
            <CommandList>
              <CommandGroup>
                {filteredColors.map((color) => (
                  <CommandItem
                    key={color.name}
                    value={color.name}
                    onSelect={() => handleColorPick(color)}
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
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

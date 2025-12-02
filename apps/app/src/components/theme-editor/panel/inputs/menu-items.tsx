"use client";

import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";

interface MenuItem {
  label: string;
  url: string;
}

// =============================================================================
// MENU ITEM BLOCK
// =============================================================================

interface MenuItemBlockProps {
  item: MenuItem;
  index: number;
  onUpdate: (updates: Partial<MenuItem>) => void;
  onDelete: () => void;
}

function MenuItemBlock({
  item,
  index,
  onUpdate,
  onDelete,
}: MenuItemBlockProps) {
  return (
    <div className="flex flex-col gap-3 p-3 border border-border bg-background">
      {/* Header with item number and delete button */}
      <div className="flex items-center justify-between">
        <span className="type-small text-tertiary">Item {index + 1}</span>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-tertiary hover:text-destructive transition-colors"
          aria-label="Delete item"
        >
          <Icons.Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Label field */}
      <div className="space-y-1.5">
        <Label variant="small">Label</Label>
        <Input
          type="text"
          value={item.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Menu item label"
          className="h-8 text-sm"
        />
      </div>

      {/* URL field */}
      <div className="space-y-1.5">
        <span className="type-small text-secondary">URL</span>
        <Input
          type="url"
          value={item.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://"
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

// =============================================================================
// MENU ITEMS (MAIN COMPONENT)
// =============================================================================

interface MenuItemsProps {
  label?: string;
  value: MenuItem[];
  onChange: (value: MenuItem[]) => void;
  className?: string;
}

export function MenuItems({
  label,
  value = [],
  onChange,
  className,
}: MenuItemsProps) {
  const handleAdd = () => {
    onChange([...value, { label: "", url: "" }]);
  };

  const handleUpdate = (index: number, updates: Partial<MenuItem>) => {
    const newItems = value.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange(newItems);
  };

  const handleDelete = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && (
        <span className="type-small font-medium text-primary">{label}</span>
      )}

      {/* Menu items list */}
      {value.length > 0 ? (
        <div className="flex flex-col gap-2">
          {value.map((item, index) => (
            <MenuItemBlock
              key={`menu-item-${index}-${item.label}`}
              item={item}
              index={index}
              onUpdate={(updates) => handleUpdate(index, updates)}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      ) : (
        <p className="type-small text-tertiary text-center py-4">
          No menu items yet
        </p>
      )}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full"
      >
        <Icons.Plus className="h-3.5 w-3.5 mr-1.5" />
        Add menu item
      </Button>
    </div>
  );
}


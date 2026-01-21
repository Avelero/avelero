"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";

// =============================================================================
// TYPES
// =============================================================================

interface MenuItem {
  label: string;
  url: string;
}

interface MenuItemEditorProps {
  menuType: "primary" | "secondary";
  configPath: string;
  itemIndex: number;
  onBack: () => void;
}

// =============================================================================
// MENU ITEM EDITOR COMPONENT
// =============================================================================

/**
 * Editor for a single menu item (button).
 * Shows Label and URL fields with live updates to themeConfig,
 * plus a Delete button.
 */
export function MenuItemEditor({
  configPath,
  itemIndex,
  onBack,
}: MenuItemEditorProps) {
  const { getConfigValue, updateConfigValue } = useDesignEditor();

  // Get current menu items
  const items = (getConfigValue(configPath) as MenuItem[] | undefined) ?? [];
  const item = items[itemIndex];

  // If item doesn't exist, go back
  if (!item) {
    onBack();
    return null;
  }

  const handleLabelChange = (newLabel: string) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...item, label: newLabel };
    updateConfigValue(configPath, newItems);
  };

  const handleUrlChange = (newUrl: string) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...item, url: newUrl };
    updateConfigValue(configPath, newItems);
  };

  const handleDelete = () => {
    const newItems = items.filter((_, i) => i !== itemIndex);
    updateConfigValue(configPath, newItems);
    onBack();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Form Fields */}
      <div className="p-4 space-y-4 flex-1">
        <div className="space-y-1.5">
          <Label variant="small">Label</Label>
          <Input
            value={item.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Button label"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label variant="small">URL</Label>
          <Input
            type="url"
            value={item.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
          />
        </div>

        {/* Delete Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
        >
          Delete button
        </Button>
      </div>
    </div>
  );
}

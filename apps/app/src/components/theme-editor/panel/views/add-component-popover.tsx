"use client";

import type { ComponentType, ZoneId } from "@v1/dpp-components";
import {
  COMPONENT_LIBRARY,
  type ComponentLibraryEntry,
} from "@v1/dpp-components/lib/component-library";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";

interface Props {
  zoneId: ZoneId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (componentType: ComponentType) => void;
  children: React.ReactNode;
}

export function AddComponentPopover({
  zoneId,
  open,
  onOpenChange,
  onSelect,
  children,
}: Props) {
  // Filter components that are allowed in this zone
  const availableComponents = Object.values(COMPONENT_LIBRARY).filter(
    (entry: ComponentLibraryEntry) => entry.allowedZones.includes(zoneId),
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-[200px] p-1">
        <div className="flex flex-col">
          <div className="px-2 py-1.5">
            <span className="type-small font-medium text-secondary">
              Add section
            </span>
          </div>
          {availableComponents.map((entry) => (
            <button
              key={entry.type}
              type="button"
              onClick={() => onSelect(entry.type)}
              className="flex items-center gap-2 h-8 px-2 type-small text-primary hover:bg-accent cursor-pointer w-full text-left"
            >
              <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
              <span>{entry.displayName}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

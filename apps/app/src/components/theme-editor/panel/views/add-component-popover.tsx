"use client";

import type { SectionType, ZoneId } from "@v1/dpp-components";
import { SECTION_REGISTRY } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";

interface Props {
  zoneId: ZoneId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sectionType: SectionType) => void;
  children: React.ReactNode;
}

export function AddComponentPopover({
  zoneId,
  open,
  onOpenChange,
  onSelect,
  children,
}: Props) {
  // Filter sections that are allowed in this zone and not hidden
  const availableSections = Object.entries(SECTION_REGISTRY).filter(
    ([, entry]) =>
      entry.schema.allowedZones.includes(zoneId) && !entry.schema.hidden,
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
          {availableSections.map(([type, entry]) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type as SectionType)}
              className="flex items-center gap-2 h-8 px-2 type-small text-primary hover:bg-accent cursor-pointer w-full text-left"
            >
              <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
              <span>{entry.schema.displayName}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

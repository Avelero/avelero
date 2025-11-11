"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SHADE_LABELS, colorFamilies } from "@v1/selections/colors";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetContent,
  SheetFooter,
} from "@v1/ui/sheet";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

/**
 * Color data shape returned when a color is created.
 */
export interface ColorData {
  /** Unique color identifier */
  id: string;
  /** Color name (e.g., "Navy Blue", "Forest Green") */
  name: string;
  /** Hex color code without # prefix (e.g., "3B82F6") */
  hex: string;
}

/**
 * Props for the ColorSheet component.
 */
interface ColorSheetProps {
  /** Controls sheet visibility */
  open: boolean;
  /** Callback when sheet open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional pre-filled color name from CSV */
  initialName?: string;
  /** Callback invoked with the created color data */
  onColorCreated: (color: ColorData) => void;
}

/** Internal page state for multi-page sheet flow */
type Page = "name" | "picker";

/**
 * Two-page sheet for creating colors with hex selection.
 *
 * This component manages a two-page flow:
 * 1. Name input page - Enter/edit color name
 * 2. Color picker page - Select hex from color families
 *
 * All form data is reset when the sheet closes.
 *
 * @param props - Sheet configuration and callbacks
 *
 * @example
 * ```tsx
 * <ColorSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   initialName="Navy Blue"
 *   onColorCreated={(color) => {
 *     console.log('Created:', color);
 *   }}
 * />
 * ```
 */
export function ColorSheet({
  open,
  onOpenChange,
  initialName = "",
  onColorCreated,
}: ColorSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState<Page>("name");
  const [name, setName] = React.useState(initialName);
  const [selectedHex, setSelectedHex] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Create color mutation
  const createColorMutation = useMutation(
    trpc.brand.colors.create.mutationOptions(),
  );

  // Update name when initialName changes (when sheet opens with pre-filled name)
  React.useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      // Delay reset to avoid visual flash during close animation
      const timer = setTimeout(() => {
        setCurrentPage("name");
        setName(initialName);
        setSelectedHex("");
        setIsSubmitting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, initialName]);

  /**
   * Handle navigation to color picker page
   */
  const handleNextToColorPicker = () => {
    if (!name.trim()) {
      toast.error("Please enter a color name");
      return;
    }
    setCurrentPage("picker");
  };

  /**
   * Handle color hex selection from picker
   */
  const handleColorSelect = (hex: string) => {
    setSelectedHex(hex);
  };

  /**
   * Handle form submission - create color
   */
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a color name");
      return;
    }

    if (!selectedHex) {
      toast.error("Please select a color");
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await createColorMutation.mutateAsync({
        name: name.trim(),
        hex: selectedHex,
      });

      // Invalidate colors list
      await queryClient.invalidateQueries({
        queryKey: trpc.brand.colors.list.queryKey(),
      });

      toast.success(`Color "${name}" created successfully`);

      // Return created color data
      const colorData: ColorData = {
        id: result.id,
        name: result.name,
        hex: result.hex,
      };

      onColorCreated(colorData);
      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create color";
      toast.error(errorMessage);
      console.error("Color creation error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Render name input page
   */
  const renderNamePage = () => (
    <div className="flex-1 px-6 py-6 overflow-y-auto">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="colorName" required>
            Color Name
          </Label>
          <Input
            id="colorName"
            placeholder="e.g. Navy Blue"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-secondary">
            This name will be used to identify the color in your catalog
          </p>
        </div>

        <div className="rounded-lg border border-border bg-accent/30 p-4">
          <div className="flex items-start gap-3">
            <Icons.Info className="h-5 w-5 text-brand mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Next: Choose Color</p>
              <p className="text-xs text-secondary">
                After entering the name, you'll select the hex color from our
                color palette
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Render color picker page
   */
  const renderColorPickerPage = () => (
    <div className="flex-1 px-6 py-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Selected color preview */}
        <div className="space-y-2">
          <Label>Selected Color</Label>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-background">
            <div
              className="h-12 w-12 rounded-md border border-border"
              style={{
                backgroundColor: selectedHex ? `#${selectedHex}` : "#E5E7EB",
              }}
            />
            <div className="flex-1">
              <div className="font-medium">{name}</div>
              <div className="text-sm text-secondary font-mono">
                {selectedHex ? `#${selectedHex}` : "No color selected"}
              </div>
            </div>
          </div>
        </div>

        {/* Color family grid */}
        <div className="space-y-4">
          <Label>Choose from Color Palette</Label>
          <div className="space-y-4">
            {colorFamilies.map((family) => (
              <div key={family.name} className="space-y-2">
                <div className="text-sm font-medium text-secondary">
                  {family.name}
                </div>
                <div className="grid grid-cols-10 gap-2">
                  {family.shades.map((hex, index) => (
                    <button
                      key={`${family.name}-${index}`}
                      type="button"
                      onClick={() => handleColorSelect(hex)}
                      className={cn(
                        "h-10 w-full rounded-md border-2 transition-all hover:scale-110",
                        selectedHex === hex
                          ? "border-brand ring-2 ring-brand/20"
                          : "border-transparent hover:border-border",
                      )}
                      style={{ backgroundColor: `#${hex}` }}
                      title={`${family.name} ${SHADE_LABELS[index]}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Page configuration for breadcrumb
  const pages: Page[] = ["name", "picker"];
  const pageLabels: Record<Page, string> = {
    name: "Name",
    picker: "Color",
  };

  const breadcrumbPages = pages.map((page) => pageLabels[page]);
  const currentPageIndex = pages.indexOf(currentPage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        <SheetBreadcrumbHeader
          pages={breadcrumbPages}
          currentPageIndex={currentPageIndex}
          onPageChange={(index) => setCurrentPage(pages[index] as Page)}
        />

        {/* Page content */}
        {currentPage === "name" && renderNamePage()}
        {currentPage === "picker" && renderColorPickerPage()}

        {/* Footer */}
        <SheetFooter className="border-t border-border">
          {currentPage === "name" ? (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="brand"
                size="default"
                onClick={handleNextToColorPicker}
                disabled={!name.trim() || isSubmitting}
              >
                Next: Choose Color
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={() => setCurrentPage("name")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                variant="brand"
                size="default"
                onClick={handleSubmit}
                disabled={!selectedHex || isSubmitting}
                icon={
                  isSubmitting ? (
                    <Icons.Spinner className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                {isSubmitting ? "Creating..." : "Create Color"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

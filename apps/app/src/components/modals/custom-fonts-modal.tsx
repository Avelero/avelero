"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useUpload } from "@/hooks/use-upload";
import { parseFontFile, normalizeFontFamily } from "@/utils/font-parser";
import { validateFontFile, FONT_EXTENSIONS } from "@/utils/upload";
import { UPLOAD_CONFIGS, buildStoragePath } from "@/utils/storage-config";
import type { CustomFont } from "@v1/dpp-components";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";

// ============================================================================
// Types
// ============================================================================

interface CustomFontsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  customFonts: CustomFont[];
  onFontsChange: (fonts: CustomFont[]) => void;
}

interface GroupedFont {
  family: string;
  variants: CustomFont[];
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomFontsModal({
  open,
  onOpenChange,
  brandId,
  customFonts,
  onFontsChange,
}: CustomFontsModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isLoading } = useUpload();

  // Group fonts by family for display
  const groupedFonts = useMemo(() => {
    const groups = new Map<string, CustomFont[]>();

    for (const font of customFonts) {
      const existing = groups.get(font.fontFamily) ?? [];
      groups.set(font.fontFamily, [...existing, font]);
    }

    return Array.from(groups.entries()).map(
      ([family, variants]): GroupedFont => ({
        family,
        variants: variants.sort((a, b) => {
          // Sort by weight (numeric comparison for single weights)
          const weightA =
            typeof a.fontWeight === "number"
              ? a.fontWeight
              : Number.parseInt(String(a.fontWeight ?? 400).split(" ")[0] ?? "400") || 400;
          const weightB =
            typeof b.fontWeight === "number"
              ? b.fontWeight
              : Number.parseInt(String(b.fontWeight ?? 400).split(" ")[0] ?? "400") || 400;
          return weightA - weightB;
        }),
      }),
    );
  }, [customFonts]);

  // Handle file upload
  const handleFile = useCallback(
    async (file: File) => {
      // 1. Validate extension
      const validation = validateFontFile(file, {
        maxBytes: UPLOAD_CONFIGS.font.maxBytes,
      });
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      try {
        // 2. Parse metadata (auto-detect family, weight, style)
        const metadata = await parseFontFile(file);
        const family = normalizeFontFamily(metadata.fontFamily);

        // 3. Build filename and upload
        const weightStr =
          typeof metadata.fontWeight === "string"
            ? metadata.fontWeight.replace(" ", "-")
            : String(metadata.fontWeight);
        const filename = `${family}-${weightStr}-${metadata.fontStyle}.${metadata.format}`;

        const result = await uploadFile({
          file,
          bucket: UPLOAD_CONFIGS.font.bucket,
          path: buildStoragePath.font(brandId, filename).split("/"),
          isPublic: true,
          validation: () => ({ valid: true }), // Already validated above
        });

        // 4. Build CustomFont object
        const newFont: CustomFont = {
          fontFamily: metadata.fontFamily, // Use original name for display
          src: result.displayUrl,
          fontWeight: metadata.fontWeight,
          fontStyle: metadata.fontStyle,
          format: metadata.format,
          fontDisplay: "swap",
        };

        // 5. Check for duplicates (same family + weight + style)
        const isDuplicate = customFonts.some(
          (f) =>
            f.fontFamily.toLowerCase() === newFont.fontFamily.toLowerCase() &&
            String(f.fontWeight) === String(newFont.fontWeight) &&
            f.fontStyle === newFont.fontStyle,
        );

        if (isDuplicate) {
          toast.error(
            `${metadata.fontFamily} (${formatWeight(metadata.fontWeight)}, ${metadata.fontStyle}) already exists.`,
          );
          return;
        }

        // 6. Update state
        onFontsChange([...customFonts, newFont]);
        toast.success(`${metadata.fontFamily} uploaded successfully`);
      } catch (error) {
        console.error("Font upload error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not parse font. Please ensure it's a valid font file.",
        );
      }
    },
    [brandId, customFonts, onFontsChange, uploadFile],
  );

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  // Handle file select from input
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      for (const file of files) {
        void handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile],
  );

  // Handle delete font
  const handleDeleteFont = useCallback(
    (fontToDelete: CustomFont) => {
      onFontsChange(customFonts.filter((f) => f.src !== fontToDelete.src));
      toast.success("Font removed");
    },
    [customFonts, onFontsChange],
  );

  // Handle delete entire font family
  const handleDeleteFamily = useCallback(
    (family: string) => {
      onFontsChange(
        customFonts.filter(
          (f) => f.fontFamily.toLowerCase() !== family.toLowerCase(),
        ),
      );
      toast.success(`${family} removed`);
    },
    [customFonts, onFontsChange],
  );

  const disabledUpload = isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 border border-border overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Custom fonts</DialogTitle>
        </DialogHeader>

        {/* Main content */}
        <div className="px-6 py-4 min-h-[160px] space-y-4">
          {/* Upload area */}
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "relative border transition-colors duration-200 cursor-pointer overflow-hidden",
              "h-[140px] flex flex-col items-center justify-center gap-2",
              isDragging
                ? "border-dashed border-brand bg-accent"
                : "border-dashed border-border hover:border-tertiary hover:bg-accent",
              disabledUpload && "opacity-60 cursor-not-allowed bg-background",
            )}
            onClick={() => {
              if (!disabledUpload) {
                inputRef.current?.click();
              }
            }}
            onKeyDown={(e) => {
              if (disabledUpload) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              if (disabledUpload) return;
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              if (disabledUpload) return;
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={disabledUpload ? undefined : handleDrop}
          >
            {isLoading ? (
              <div className="flex items-center gap-2 type-small text-primary">
                <Icons.Loader className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-tertiary px-4">
                <Icons.Upload className="h-5 w-5" />
                <p className="type-small text-center">
                  Drop font files here or click to upload
                </p>
                <p className="type-small text-center text-tertiary">
                  Supports: {FONT_EXTENSIONS.join(", ")}
                </p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={FONT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              multiple
              className="hidden"
              onChange={handleFileSelect}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Uploaded fonts list */}
          {groupedFonts.length > 0 && (
            <div className="space-y-2">
              <p className="type-small text-secondary">
                Uploaded fonts
              </p>
              <div className="space-y-2">
                {groupedFonts.map((group) => (
                  <FontFamilyGroup
                    key={group.family}
                    group={group}
                    onDeleteFont={handleDeleteFont}
                    onDeleteFamily={handleDeleteFamily}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <div className="flex items-center justify-end w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface FontFamilyGroupProps {
  group: GroupedFont;
  onDeleteFont: (font: CustomFont) => void;
  onDeleteFamily: (family: string) => void;
}

function FontFamilyGroup({
  group,
  onDeleteFont,
  onDeleteFamily,
}: FontFamilyGroupProps) {
  const hasMultipleVariants = group.variants.length > 1;

  return (
    <div className="border border-border overflow-hidden">
      {/* Family header (when multiple variants) */}
      {hasMultipleVariants && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="type-small font-medium text-primary">
            {group.family}
          </span>
          <FontActionsMenu
            onDelete={() => onDeleteFamily(group.family)}
            label={`Delete all ${group.family} variants`}
          />
        </div>
      )}

      {/* Variants */}
      <div className="divide-y border-border">
        {group.variants.map((font, index) => (
          <FontVariantRow
            key={`${font.src}-${index}`}
            font={font}
            showFamilyName={!hasMultipleVariants}
            onDelete={() => onDeleteFont(font)}
          />
        ))}
      </div>
    </div>
  );
}

interface FontVariantRowProps {
  font: CustomFont;
  showFamilyName: boolean;
  onDelete: () => void;
}

function FontVariantRow({ font, showFamilyName, onDelete }: FontVariantRowProps) {
  const weightLabel = formatWeight(font.fontWeight);
  const isVariable =
    typeof font.fontWeight === "string" && font.fontWeight.includes(" ");

  return (
    <div className="flex items-center justify-between px-3 py-2.5 hover:bg-accent/30 transition-colors">
      <div className="flex flex-col gap-0.5 min-w-0">
        {showFamilyName ? (
          <>
            <span className="type-small font-medium text-primary truncate">
              {font.fontFamily}
            </span>
            <span className="type-small text-tertiary">
              {weightLabel}
              {font.fontStyle === "italic" && ", Italic"}
              {isVariable && (
                <span className="ml-1.5 px-1.5 py-0.5 type-xsmall">
                  Variable
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="type-small text-secondary">
            {weightLabel}
            {font.fontStyle === "italic" && ", Italic"}
            {isVariable && (
              <span className="ml-1.5 px-1.5 py-0.5 type-xsmall bg-accent">
                Variable
              </span>
            )}
          </span>
        )}
      </div>
      <FontActionsMenu onDelete={onDelete} label="Delete font" />
    </div>
  );
}

interface FontActionsMenuProps {
  onDelete: () => void;
  label: string;
}

function FontActionsMenu({ onDelete, label }: FontActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1 hover:bg-accent text-tertiary hover:text-secondary transition-colors"
          aria-label={label}
        >
          <Icons.EllipsisVertical className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[140px]">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 type-small text-destructive hover:bg-accent transition-colors"
        >
          <Icons.Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatWeight(weight: number | string | undefined): string {
  if (!weight) return "Regular (400)";

  if (typeof weight === "string" && weight.includes(" ")) {
    const [min, max] = weight.split(" ");
    return `${min}–${max}`;
  }

  const numWeight = typeof weight === "number" ? weight : Number.parseInt(weight);

  const weightNames: Record<number, string> = {
    100: "Thin",
    200: "Extra Light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semi Bold",
    700: "Bold",
    800: "Extra Bold",
    900: "Black",
  };

  const name = weightNames[numWeight] ?? "";
  return name ? `${name} (${numWeight})` : String(numWeight);
}


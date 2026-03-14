"use client";

/**
 * Custom font management modal for uploading and removing brand fonts.
 */

import { useUpload } from "@/hooks/use-upload";
import {
  type ParsedFontMetadata,
  normalizeFontFamily,
  parseFontFile,
} from "@/utils/font-parser";
import { UPLOAD_CONFIGS, buildStoragePath } from "@/utils/storage-config";
import { FONT_EXTENSIONS, validateFontFile } from "@/utils/upload";
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
import { useCallback, useMemo, useRef, useState } from "react";

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

/**
 * Normalize a stored font weight into a stable comparison key.
 */
function normalizeFontWeightValue(weight: number | string | undefined): string {
  if (weight === undefined) return "400";
  if (typeof weight === "number") return String(weight);
  return weight.trim().replace(/\s+/g, " ");
}

/**
 * Build a stable variant key used for duplicate detection.
 */
function getFontVariantKey(font: {
  fontFamily: string;
  fontWeight?: number | string;
  fontStyle?: string;
}): string {
  return [
    normalizeFontFamily(font.fontFamily),
    normalizeFontWeightValue(font.fontWeight),
    font.fontStyle?.toLowerCase() ?? "normal",
  ].join(":");
}

/**
 * Extract the file extension for a font upload.
 */
function getFontFileExtension(
  file: File,
  metadata: ParsedFontMetadata,
): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (
    ext &&
    FONT_EXTENSIONS.includes(ext as (typeof FONT_EXTENSIONS)[number])
  ) {
    return ext;
  }

  switch (metadata.format) {
    case "woff2":
      return "woff2";
    case "woff":
      return "woff";
    case "opentype":
      return "otf";
    default:
      return "ttf";
  }
}

/**
 * Build a deterministic filename for a parsed font variant.
 */
function buildFontFilename(file: File, metadata: ParsedFontMetadata): string {
  const family = normalizeFontFamily(metadata.fontFamily);
  const weight = normalizeFontWeightValue(metadata.fontWeight).replace(
    /\s+/g,
    "-",
  );
  const style = metadata.fontStyle;
  const ext = getFontFileExtension(file, metadata);

  return `${family}-${weight}-${style}.${ext}`;
}

/**
 * Sort fonts by their numeric weight so families render in a stable order.
 */
function getSortableWeight(font: CustomFont): number {
  if (typeof font.fontWeight === "number") {
    return font.fontWeight;
  }

  return Number.parseInt(
    String(font.fontWeight ?? 400).split(" ")[0] ?? "400",
    10,
  );
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
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isLoading } = useUpload();

  const groupedFonts = useMemo(() => {
    const groups = new Map<string, CustomFont[]>();

    for (const font of customFonts) {
      const existing = groups.get(font.fontFamily) ?? [];
      groups.set(font.fontFamily, [...existing, font]);
    }

    return Array.from(groups.entries()).map(
      ([family, variants]): GroupedFont => ({
        family,
        variants: variants.sort(
          (a, b) => getSortableWeight(a) - getSortableWeight(b),
        ),
      }),
    );
  }, [customFonts]);

  /**
   * Parse, dedupe, upload, and commit a selected batch of font files.
   */
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsUploadingBatch(true);
      const acceptedFonts: CustomFont[] = [];
      const seenVariantKeys = new Set(customFonts.map(getFontVariantKey));

      try {
        for (const file of files) {
          const validation = validateFontFile(file, {
            maxBytes: UPLOAD_CONFIGS.font.maxBytes,
          });

          if (!validation.valid) {
            toast.error(validation.error);
            continue;
          }

          try {
            const metadata = await parseFontFile(file);
            const variantKey = getFontVariantKey(metadata);

            if (seenVariantKeys.has(variantKey)) {
              toast.error(
                `${metadata.fontFamily} (${formatWeight(metadata.fontWeight)}, ${metadata.fontStyle}) already exists.`,
              );
              continue;
            }

            const filename = buildFontFilename(file, metadata);
            const result = await uploadFile({
              file,
              bucket: UPLOAD_CONFIGS.font.bucket,
              path: buildStoragePath.font(brandId, filename).split("/"),
              isPublic: true,
              upsert: false,
              validation: () => ({ valid: true }),
            });

            const newFont: CustomFont = {
              fontFamily: metadata.fontFamily,
              src: result.displayUrl,
              fontWeight: metadata.fontWeight,
              fontStyle: metadata.fontStyle,
              format: metadata.format,
              fontDisplay: "swap",
            };

            acceptedFonts.push(newFont);
            seenVariantKeys.add(variantKey);
            toast.success(`${metadata.fontFamily} uploaded successfully`);
          } catch (error) {
            console.error("Font upload error:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not parse font. Please ensure it's a valid font file.",
            );
          }
        }

        if (acceptedFonts.length > 0) {
          onFontsChange([...customFonts, ...acceptedFonts]);
        }
      } finally {
        setIsUploadingBatch(false);
      }
    },
    [brandId, customFonts, onFontsChange, uploadFile],
  );

  /**
   * Accept a drag-and-drop batch of font files.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      void handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles],
  );

  /**
   * Accept a file input selection batch of font files.
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      void handleFiles(files);
      e.target.value = "";
    },
    [handleFiles],
  );

  /**
   * Remove a single uploaded font variant.
   */
  const handleDeleteFont = useCallback(
    (fontToDelete: CustomFont) => {
      onFontsChange(customFonts.filter((f) => f.src !== fontToDelete.src));
      toast.success("Font removed");
    },
    [customFonts, onFontsChange],
  );

  /**
   * Remove every uploaded variant for a font family.
   */
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

  const disabledUpload = isUploadingBatch || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Custom fonts</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[160px] space-y-4">
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
            {disabledUpload ? (
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

          {groupedFonts.length > 0 ? (
            <div className="space-y-2">
              <p className="type-small text-secondary">Uploaded fonts</p>
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
          ) : null}
        </div>

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

/**
 * Render a grouped font family with its uploaded variants.
 */
function FontFamilyGroup({
  group,
  onDeleteFont,
  onDeleteFamily,
}: FontFamilyGroupProps) {
  const hasMultipleVariants = group.variants.length > 1;

  return (
    <div className="border border-border overflow-hidden">
      {hasMultipleVariants ? (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="type-small font-medium text-primary">
            {group.family}
          </span>
          <FontActionsMenu
            onDelete={() => onDeleteFamily(group.family)}
            label={`Delete all ${group.family} variants`}
          />
        </div>
      ) : null}

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

/**
 * Render a single uploaded font variant row.
 */
function FontVariantRow({
  font,
  showFamilyName,
  onDelete,
}: FontVariantRowProps) {
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
              {font.fontStyle === "italic" ? ", Italic" : null}
              {isVariable ? (
                <span className="ml-1.5 px-1.5 py-0.5 type-xsmall">
                  Variable
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="type-small text-secondary">
            {weightLabel}
            {font.fontStyle === "italic" ? ", Italic" : null}
            {isVariable ? (
              <span className="ml-1.5 px-1.5 py-0.5 type-xsmall bg-accent">
                Variable
              </span>
            ) : null}
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

/**
 * Render the per-row action menu for deleting a font.
 */
function FontActionsMenu({ onDelete, label }: FontActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1 hover:bg-accent data-[state=open]:bg-accent text-tertiary hover:text-secondary data-[state=open]:text-secondary transition-colors"
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

/**
 * Format a font weight into a human-readable label for the modal.
 */
function formatWeight(weight: number | string | undefined): string {
  if (!weight) return "Regular (400)";

  if (typeof weight === "string" && weight.includes(" ")) {
    const [min, max] = weight.split(" ");
    return `${min}–${max}`;
  }

  const numWeight =
    typeof weight === "number" ? weight : Number.parseInt(weight, 10);

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

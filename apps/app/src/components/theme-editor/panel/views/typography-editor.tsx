"use client";

/**
 * Typography editor for type scale, font family, and font-specific weight controls.
 */
import { saveThemeAction } from "@/actions/design/save-theme-action";
import { CustomFontsModal } from "@/components/modals/custom-fonts-modal";
import { FontSelect } from "@/components/select/font-select";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomFont, TypographyScale } from "@v1/dpp-components";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { AccordionItem, FieldWrapper, PixelInput } from "../inputs";
import {
  CAPITALIZATION_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  TRACKING_OPTIONS,
  ThemeTypographySelect,
  getAvailableWeightOptions,
} from "./shared-typography";

// Typography scale configuration
const TYPOGRAPHY_SCALES = [
  { key: "h1" as const, label: "Heading 1" },
  { key: "h2" as const, label: "Heading 2" },
  { key: "h3" as const, label: "Heading 3" },
  { key: "h4" as const, label: "Heading 4" },
  { key: "h5" as const, label: "Heading 5" },
  { key: "h6" as const, label: "Heading 6" },
  { key: "body" as const, label: "Body" },
  { key: "body-sm" as const, label: "Small" },
  { key: "body-xs" as const, label: "Extra Small" },
] as const;

type TypographyScaleKey = (typeof TYPOGRAPHY_SCALES)[number]["key"];

// Typography scale form (inlined)
interface TypographyScaleFormProps {
  value: TypographyScale;
  onChange: (value: TypographyScale) => void;
  customFonts: CustomFont[];
  onManageCustomFonts: () => void;
}

function TypographyScaleForm({
  value,
  onChange,
  customFonts,
  onManageCustomFonts,
}: TypographyScaleFormProps) {
  const handleChange = <K extends keyof TypographyScale>(
    key: K,
    newValue: TypographyScale[K],
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  const weightOptions = React.useMemo(
    () => getAvailableWeightOptions(value.fontFamily, customFonts),
    [value.fontFamily, customFonts],
  );

  React.useEffect(() => {
    const currentWeight = Number.parseInt(String(value.fontWeight ?? 400), 10);
    const hasCurrentWeight = weightOptions.some(
      (option) => Number.parseInt(option.value, 10) === currentWeight,
    );

    if (!hasCurrentWeight) {
      const fallbackWeight = Number.parseInt(
        weightOptions[0]?.value ?? "400",
        10,
      );
      onChange({ ...value, fontWeight: fallbackWeight });
    }
  }, [weightOptions, value, onChange]);

  const fontSizeValue =
    typeof value.fontSize === "number"
      ? value.fontSize
      : Number.parseFloat(String(value.fontSize)) || 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Font Family */}
      <FieldWrapper label="Font">
        <FontSelect
          value={value.fontFamily || null}
          onValueChange={(v) => handleChange("fontFamily", v)}
          placeholder="Select font..."
          className="h-8 text-sm"
          customFonts={customFonts}
          onManageCustomFonts={onManageCustomFonts}
        />
      </FieldWrapper>

      {/* Size and Weight row */}
      <div className="grid grid-cols-2 gap-3">
        <PixelInput
          label="Size"
          value={fontSizeValue}
          onChange={(v) => handleChange("fontSize", v)}
          min={0}
          step={1}
          placeholder="px"
        />
        <FieldWrapper label="Weight">
          <ThemeTypographySelect
            value={String(value.fontWeight || "400")}
            onValueChange={(v) =>
              handleChange("fontWeight", Number.parseInt(v, 10))
            }
            options={weightOptions}
            placeholder="Select weight..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>

      {/* Line height and Tracking row */}
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Line height">
          <ThemeTypographySelect
            value={String(value.lineHeight || "1.25")}
            onValueChange={(v) =>
              handleChange("lineHeight", Number.parseFloat(v))
            }
            options={LINE_HEIGHT_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
        <FieldWrapper label="Tracking">
          <ThemeTypographySelect
            value={String(value.letterSpacing ?? 0)}
            onValueChange={(v) =>
              handleChange("letterSpacing", Number.parseFloat(v))
            }
            options={TRACKING_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        </FieldWrapper>
      </div>

      {/* Capitalization row */}
      <FieldWrapper label="Capitalization">
        <ThemeTypographySelect
          value={value.textTransform || "none"}
          onValueChange={(v) =>
            handleChange("textTransform", v as TypographyScale["textTransform"])
          }
          options={CAPITALIZATION_OPTIONS}
          placeholder="Select..."
          className="h-8 text-sm"
        />
      </FieldWrapper>
    </div>
  );
}

export function TypographyEditor() {
  const { passportDraft, updateCustomFonts, updateTypographyScale, brandId } =
    useDesignEditor();
  const [openItem, setOpenItem] = React.useState<string | null>(null);
  const [customFontsModalOpen, setCustomFontsModalOpen] = React.useState(false);
  const passportDraftRef = React.useRef(passportDraft);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  React.useEffect(() => {
    passportDraftRef.current = passportDraft;
  }, [passportDraft]);

  const toggleItem = (key: string) => {
    setOpenItem((prev) => (prev === key ? null : key));
  };

  const getTypographyValue = (scale: TypographyScaleKey): TypographyScale => {
    return passportDraft.tokens.typography?.[scale] || ({} as TypographyScale);
  };

  // Get custom fonts from passport tokens
  const customFonts = passportDraft.tokens.fonts ?? [];

  // Update custom fonts and auto-save to database
  const handleCustomFontsChange = React.useCallback(
    async (fonts: CustomFont[]) => {
      const updatedPassport = {
        ...passportDraftRef.current,
        tokens: {
          ...passportDraftRef.current.tokens,
          fonts,
        },
      };

      passportDraftRef.current = updatedPassport;

      // Update local state immediately for UI
      updateCustomFonts(fonts);

      // Auto-save to database so fonts persist without clicking Save
      if (brandId) {
        try {
          const result = await saveThemeAction({
            brandId,
            passport: updatedPassport,
          });
          if (result?.serverError) {
            throw new Error(result.serverError);
          }
          // Invalidate cache so re-entering the editor shows the fonts
          await queryClient.invalidateQueries({
            queryKey: trpc.brand.theme.get.queryKey(),
          });
        } catch {
          toast.error("Failed to save custom fonts");
        }
      }
    },
    [updateCustomFonts, brandId, queryClient, trpc],
  );

  const handleManageCustomFonts = React.useCallback(() => {
    setCustomFontsModalOpen(true);
  }, []);

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {TYPOGRAPHY_SCALES.map(({ key, label }) => (
          <AccordionItem
            key={key}
            label={label}
            isOpen={openItem === key}
            onToggle={() => toggleItem(key)}
          >
            <TypographyScaleForm
              value={getTypographyValue(key)}
              onChange={(value) => updateTypographyScale(key, value)}
              customFonts={customFonts}
              onManageCustomFonts={handleManageCustomFonts}
            />
          </AccordionItem>
        ))}
      </div>

      {/* Custom Fonts Modal */}
      {brandId && (
        <CustomFontsModal
          open={customFontsModalOpen}
          onOpenChange={setCustomFontsModalOpen}
          brandId={brandId}
          customFonts={customFonts}
          onFontsChange={handleCustomFontsChange}
        />
      )}
    </>
  );
}

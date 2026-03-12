"use client";

/**
 * Component-level typography field with attach/detach behavior.
 *
 * When attached, the field inherits from a shared typescale token. When
 * detached, it exposes the full typography override set for that component.
 */

import { FontSelect } from "@/components/select/font-select";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import type { TypeScale, TypographyScale } from "@v1/dpp-components";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import * as React from "react";
import { type StyleField, TYPESCALE_OPTIONS } from "../../registry";
import { FieldWrapper, PixelInput } from "../inputs";
import {
  CAPITALIZATION_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  TRACKING_OPTIONS,
  ThemeTypographySelect,
  getAvailableWeightOptions,
} from "./shared-typography";

type TextTransformValue = TypographyScale["textTransform"];

/**
 * Split a style field path into its style key and property name.
 */
function splitStyleFieldPath(
  path: string,
): { styleKey: string; property: string } | null {
  const separatorIndex = path.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= path.length - 1) {
    return null;
  }

  return {
    styleKey: path.slice(0, separatorIndex),
    property: path.slice(separatorIndex + 1),
  };
}

/**
 * Build a small icon button with a tooltip for attach/detach actions.
 */
function TypographyModeButton({
  detached,
  onClick,
}: {
  detached: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded"
            onClick={onClick}
            aria-label={
              detached ? "Attach typography token" : "Detach typography token"
            }
          >
            {detached ? (
              <Icons.Link className="h-4 w-4" />
            ) : (
              <Icons.Unlink className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {detached ? "Attach style" : "Detach style"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Render the attach/detach typography control for a single component field.
 */
export function TypographyStyleField({ field }: { field: StyleField }) {
  const { passportDraft, getRawComponentStyleValue, updateComponentStyle } =
    useDesignEditor();
  const pathParts = React.useMemo(
    () => splitStyleFieldPath(field.path),
    [field.path],
  );

  /**
   * Read a raw typography style value for the current field.
   */
  const readStyleValue = React.useCallback(
    (property: string) => {
      if (!pathParts) return undefined;
      return getRawComponentStyleValue(`${pathParts.styleKey}.${property}`);
    },
    [getRawComponentStyleValue, pathParts],
  );

  /**
   * Persist a raw typography style value for the current field.
   */
  const writeStyleValue = React.useCallback(
    (property: string, value: string | number | boolean | undefined) => {
      if (!pathParts) return;
      updateComponentStyle(`${pathParts.styleKey}.${property}`, value);
    },
    [pathParts, updateComponentStyle],
  );

  const rawTypescale = getRawComponentStyleValue(field.path);
  const typescale =
    typeof rawTypescale === "string" ? (rawTypescale as TypeScale) : null;
  const scaleConfig = typescale
    ? passportDraft.tokens.typography[typescale]
    : undefined;
  const customFonts = passportDraft.tokens.fonts ?? [];

  const isDetached = readStyleValue("typographyDetached") === true;

  const rawFontFamily = readStyleValue("fontFamily");
  const fontFamily =
    typeof rawFontFamily === "string" ? rawFontFamily : scaleConfig?.fontFamily;

  const rawFontSize = readStyleValue("fontSize");
  const fontSize =
    typeof rawFontSize === "number" ? rawFontSize : scaleConfig?.fontSize ?? 0;

  const rawFontWeight = readStyleValue("fontWeight");
  const fontWeight =
    typeof rawFontWeight === "number"
      ? rawFontWeight
      : scaleConfig?.fontWeight ?? 400;

  const rawLineHeight = readStyleValue("lineHeight");
  const lineHeight =
    typeof rawLineHeight === "number"
      ? rawLineHeight
      : scaleConfig?.lineHeight ?? 1.25;

  const rawLetterSpacing = readStyleValue("letterSpacing");
  const letterSpacing =
    typeof rawLetterSpacing === "number"
      ? rawLetterSpacing
      : scaleConfig?.letterSpacing ?? 0;

  const rawTextTransform = readStyleValue("textTransform");
  const textTransform =
    (typeof rawTextTransform === "string"
      ? (rawTextTransform as TextTransformValue)
      : scaleConfig?.textTransform) ?? "none";

  const weightOptions = React.useMemo(
    () => getAvailableWeightOptions(fontFamily, customFonts),
    [customFonts, fontFamily],
  );

  React.useEffect(() => {
    if (!isDetached) return;

    const currentWeight = Number.parseInt(String(fontWeight ?? 400), 10);
    const hasCurrentWeight = weightOptions.some(
      (option) => Number.parseInt(option.value, 10) === currentWeight,
    );

    if (!hasCurrentWeight) {
      const fallbackWeight = Number.parseInt(
        weightOptions[0]?.value ?? "400",
        10,
      );
      writeStyleValue("fontWeight", fallbackWeight);
    }
  }, [fontWeight, isDetached, weightOptions, writeStyleValue]);

  /**
   * Copy the resolved token typography into local overrides.
   */
  const handleDetach = React.useCallback(() => {
    if (!pathParts) return;

    writeStyleValue("fontFamily", fontFamily);
    writeStyleValue("fontSize", fontSize);
    writeStyleValue("fontWeight", fontWeight);
    writeStyleValue("lineHeight", lineHeight);
    writeStyleValue("letterSpacing", letterSpacing);
    writeStyleValue("textTransform", textTransform);
    writeStyleValue("typographyDetached", true);
  }, [
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    pathParts,
    textTransform,
    writeStyleValue,
  ]);

  /**
   * Remove local typography overrides and re-attach the shared token.
   */
  const handleAttach = React.useCallback(() => {
    if (!pathParts) return;

    writeStyleValue("typographyDetached", undefined);
    writeStyleValue("fontFamily", undefined);
    writeStyleValue("fontSize", undefined);
    writeStyleValue("fontWeight", undefined);
    writeStyleValue("lineHeight", undefined);
    writeStyleValue("letterSpacing", undefined);
    writeStyleValue("textTransform", undefined);
  }, [pathParts, writeStyleValue]);

  /**
   * Toggle between token-attached and detached typography editing.
   */
  const handleTypographyModeToggle = React.useCallback(() => {
    if (isDetached) {
      handleAttach();
      return;
    }

    handleDetach();
  }, [handleAttach, handleDetach, isDetached]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label variant="small">{field.label}</Label>
          <TypographyModeButton
            detached={isDetached}
            onClick={handleTypographyModeToggle}
          />
        </div>

        {!isDetached ? (
          <ThemeTypographySelect
            value={typescale}
            onValueChange={(value) => updateComponentStyle(field.path, value)}
            options={TYPESCALE_OPTIONS}
            placeholder="Select..."
            className="h-8 text-sm"
          />
        ) : null}
      </div>

      {isDetached ? (
        <div className="space-y-3">
          <FieldWrapper label="Font">
            <FontSelect
              value={fontFamily ?? null}
              onValueChange={(value) => writeStyleValue("fontFamily", value)}
              placeholder="Select font..."
              className="h-8 text-sm"
              customFonts={customFonts}
            />
          </FieldWrapper>

          <div className="grid grid-cols-2 gap-3">
            <PixelInput
              label="Size"
              value={fontSize}
              onChange={(value) => writeStyleValue("fontSize", value)}
              min={0}
              step={1}
              placeholder="px"
            />

            <FieldWrapper label="Weight">
              <ThemeTypographySelect
                value={String(fontWeight)}
                onValueChange={(value) =>
                  writeStyleValue("fontWeight", Number.parseInt(value, 10))
                }
                options={weightOptions}
                placeholder="Select..."
                className="h-8 text-sm"
              />
            </FieldWrapper>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Line height">
              <ThemeTypographySelect
                value={String(lineHeight)}
                onValueChange={(value) =>
                  writeStyleValue("lineHeight", Number.parseFloat(value))
                }
                options={LINE_HEIGHT_OPTIONS}
                placeholder="Select..."
                className="h-8 text-sm"
              />
            </FieldWrapper>

            <FieldWrapper label="Tracking">
              <ThemeTypographySelect
                value={String(letterSpacing)}
                onValueChange={(value) =>
                  writeStyleValue("letterSpacing", Number.parseFloat(value))
                }
                options={TRACKING_OPTIONS}
                placeholder="Select..."
                className="h-8 text-sm"
              />
            </FieldWrapper>
          </div>
        </div>
      ) : null}

      <FieldWrapper label="Capitalization">
        <ThemeTypographySelect
          value={textTransform}
          onValueChange={(value) =>
            writeStyleValue("textTransform", value as TextTransformValue)
          }
          options={CAPITALIZATION_OPTIONS}
          placeholder="Select..."
          className="h-8 text-sm"
        />
      </FieldWrapper>
    </div>
  );
}

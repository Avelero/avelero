/**
 * Resolves section style overrides into React.CSSProperties for inline rendering.
 *
 * Pure function — SSR-safe, no hooks. Call directly in server component bodies.
 */

import { getFontFallback } from "@v1/selections/fonts";
import type {
  ColorTokens,
  Passport,
  StyleOverride,
  Styles,
  TypographyScale,
} from "../types/passport";

type Tokens = Passport["tokens"];

/** Resolve a color value: "$foreground" → hex from tokens, or pass through hex directly. */
function resolveColor(
  value: string | undefined,
  colors: ColorTokens,
): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("$")) {
    return colors[value.slice(1) as keyof ColorTokens];
  }
  return value;
}

/** Resolve a typescale reference to concrete typography properties. */
function resolveTypescale(
  scale: TypographyScale,
): Pick<
  React.CSSProperties,
  "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing"
> {
  return {
    fontFamily: `"${scale.fontFamily}", ${getFontFallback(scale.fontFamily)}`,
    fontSize: `${scale.fontSize / 16}rem`,
    fontWeight: scale.fontWeight,
    lineHeight: scale.lineHeight,
    letterSpacing:
      scale.letterSpacing === 0 ? undefined : `${scale.letterSpacing}px`,
  };
}

/** Resolve detached typography overrides on top of an attached typescale. */
function applyTypographyOverrides(
  css: React.CSSProperties,
  override: StyleOverride,
): void {
  if (override.fontSize !== undefined) {
    css.fontSize = `${override.fontSize / 16}rem`;
  }
  if (override.fontWeight !== undefined) {
    css.fontWeight = override.fontWeight;
  }
  if (override.lineHeight !== undefined) {
    css.lineHeight = override.lineHeight;
  }
  if (override.letterSpacing !== undefined) {
    css.letterSpacing = `${override.letterSpacing}px`;
  }
}

/** Resolve a single StyleOverride into CSSProperties. */
function resolveOverride(
  override: StyleOverride,
  tokens: Tokens,
): React.CSSProperties {
  const css: React.CSSProperties = {};

  // Colors
  const color = resolveColor(override.color, tokens.colors);
  if (color) css.color = color;

  const bg = resolveColor(override.backgroundColor, tokens.colors);
  if (bg) css.backgroundColor = bg;

  if (override.boxShadow) css.boxShadow = override.boxShadow;

  const bc = resolveColor(override.borderColor, tokens.colors);
  if (bc) css.borderColor = bc;

  // Typography via typescale
  if (override.typescale) {
    const scale = tokens.typography[override.typescale];
    if (scale) Object.assign(css, resolveTypescale(scale));
  }
  applyTypographyOverrides(css, override);

  // Text
  if (override.textTransform) css.textTransform = override.textTransform;
  if (override.textAlign) css.textAlign = override.textAlign;

  // Border radius
  if (override.borderRadius !== undefined) {
    if (typeof override.borderRadius === "number") {
      css.borderRadius = `${override.borderRadius}px`;
    } else {
      const r = override.borderRadius;
      css.borderRadius = `${r.topLeft}px ${r.topRight}px ${r.bottomRight}px ${r.bottomLeft}px`;
    }
  }

  // Border width
  if (override.borderWidth !== undefined) {
    if (typeof override.borderWidth === "number") {
      css.borderWidth = `${override.borderWidth}px`;
    } else {
      const b = override.borderWidth;
      css.borderWidth = `${b.top}px ${b.right}px ${b.bottom}px ${b.left}px`;
    }
    css.borderStyle = "solid";
  }

  // Flexbox
  if (override.alignItems)
    css.alignItems = override.alignItems as React.CSSProperties["alignItems"];
  if (override.justifyContent)
    css.justifyContent =
      override.justifyContent as React.CSSProperties["justifyContent"];

  // Icon sizing
  if (override.size !== undefined) {
    css.width = `${override.size}px`;
    css.height = `${override.size}px`;
  }

  return css;
}

/**
 * Resolves a Styles record into a map of element names to CSSProperties.
 *
 * Usage in section components:
 * ```ts
 * const s = resolveStyles(section.styles, passport.tokens);
 * return <h3 style={s.title}>...</h3>
 * ```
 */
export function resolveStyles(
  styles: Styles | undefined,
  tokens: Tokens,
): Record<string, React.CSSProperties> {
  if (!styles) return {};
  const result: Record<string, React.CSSProperties> = {};
  for (const [key, override] of Object.entries(styles)) {
    result[key] = resolveOverride(override, tokens);
  }
  return result;
}

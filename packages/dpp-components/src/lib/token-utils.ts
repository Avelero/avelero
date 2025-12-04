/**
 * Token Utilities
 *
 * Utilities for working with design token references in theme styles.
 *
 * Token references use the "$tokenName" format:
 * - "$foreground" references colors.foreground
 * - "$primary" references colors.primary
 * - "$border" references colors.border
 *
 * This allows component colors to cascade from design tokens,
 * so changing a design token updates all components using it.
 */

/**
 * Valid design token color keys
 */
export type ColorTokenKey =
  | "background"
  | "foreground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "card"
  | "cardForeground"
  | "primary"
  | "primaryForeground"
  | "destructive"
  | "destructiveForeground"
  | "success"
  | "successForeground"
  | "border"
  | "link";

/**
 * Checks if a value is a design token reference (starts with $)
 * e.g., "$foreground", "$primary", "$border"
 */
export function isTokenReference(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("$");
}

/**
 * Extracts the token name from a token reference
 * e.g., "$foreground" -> "foreground"
 */
export function getTokenName(tokenRef: string): string {
  return tokenRef.slice(1);
}

/**
 * Creates a token reference from a token name
 * e.g., "foreground" -> "$foreground"
 */
export function createTokenRef(tokenName: string): string {
  return `$${tokenName}`;
}

/**
 * Converts camelCase to kebab-case
 * e.g., "mutedForeground" -> "muted-foreground"
 */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Converts a token reference to a CSS variable reference
 * e.g., "$foreground" -> "var(--foreground)"
 * e.g., "$mutedForeground" -> "var(--muted-foreground)"
 */
export function tokenToCssVar(token: string): string {
  const tokenName = getTokenName(token);
  const cssVarName = camelToKebab(tokenName);
  return `var(--${cssVarName})`;
}

/**
 * Resolves a token reference to its actual color value
 * e.g., "$foreground" with colors.foreground = "#1E2040" -> "#1E2040"
 *
 * If the value is not a token reference, returns it as-is.
 * If the token doesn't exist in colors, returns undefined.
 */
export function resolveTokenValue(
  value: unknown,
  colors: Record<string, string | undefined> | undefined,
): string | undefined {
  if (!isTokenReference(value)) {
    return typeof value === "string" ? value : undefined;
  }

  const tokenName = getTokenName(value);
  return colors?.[tokenName];
}

/**
 * Token Utilities
 *
 * Utilities for working with design token references in style overrides.
 *
 * Token references use the "$tokenName" format:
 * - "$foreground" references colors.foreground
 * - "$primary" references colors.primary
 */

/**
 * Checks if a value is a design token reference (starts with $).
 */
export function isTokenReference(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("$");
}

/**
 * Extracts the token name from a token reference.
 * e.g., "$foreground" -> "foreground"
 */
export function getTokenName(tokenRef: string): string {
  return tokenRef.slice(1);
}

/**
 * Creates a token reference from a token name.
 * e.g., "foreground" -> "$foreground"
 */
export function createTokenRef(tokenName: string): string {
  return `$${tokenName}`;
}

/**
 * Resolves a token reference to its actual color value.
 * If not a token reference, returns as-is.
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

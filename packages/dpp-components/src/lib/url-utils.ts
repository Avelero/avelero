/**
 * URL normalization helpers for external links in DPP components.
 */

const EXTERNAL_PROTOCOL_REGEX = /^https?:\/\//i;

export function toExternalHref(url?: string): string | undefined {
  // Normalize optional URLs so plain domains remain clickable external links.
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (EXTERNAL_PROTOCOL_REGEX.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

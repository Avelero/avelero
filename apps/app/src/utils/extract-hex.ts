export function extractHex(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;

  if (typeof meta.swatch === "string") return meta.swatch;
  if (typeof meta.hex === "string") {
    return meta.hex.startsWith("#") ? meta.hex : `#${meta.hex}`;
  }

  return null;
}

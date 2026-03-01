/**
 * Deterministic avatar color utility.
 *
 * Maps UUIDs to a curated palette of 24 visually distinct colors.
 * Always returns the same color for the same UUID.
 */
const AVATAR_COLORS = [
  "#714D41",
  "#916354",
  "#AB7D6E",
  "#0A7640",
  "#0DA559",
  "#11D473",
  "#3D7575",
  "#4F9696",
  "#69B0B0",
  "#4E667E",
  "#627F9D",
  "#8299B0",
  "#0000B2",
  "#0000E5",
  "#3333FF",
  "#66517B",
  "#7F659A",
  "#9984AE",
  "#6C2D4D",
  "#903C66",
  "#B44B80",
  "#B01C1C",
  "#DD2222",
  "#E34F4F",
] as const;

/**
 * FNV-1a hash for stable, well-distributed results.
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Returns a deterministic hex color for a given UUID.
 *
 * @param uuid - The UUID to derive a color from
 * @returns A hex color string from the curated palette
 */
export function getAvatarColor(uuid: string): string {
  const hash = fnv1a(uuid || "default");
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] as string;
}

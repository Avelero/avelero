// Server-only: stable hue selection and HSL formatting for avatar fallbacks.

export const HUE_START = 1;
export const HUE_COUNT = 360; // inclusive range 1..359
export const HUE_END = HUE_START + HUE_COUNT - 2; // 359
export const SATURATION = 100;
export const LIGHTNESS = 33;

// FNV-1a hash for stable distribution
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function hueFromName(name: string): number {
  const h = fnv1a(name || "default");
  return HUE_START + (h % HUE_COUNT); // 1..359
}

export function clampHue(hue: number): number {
  if (Number.isFinite(hue) && hue >= HUE_START && hue <= HUE_END) return hue;
  return HUE_START;
}

export function hslFromHue(
  hue: number,
): `hsl(${number} ${number}% ${number}%)` {
  return `hsl(${clampHue(hue)} ${SATURATION}% ${LIGHTNESS}%)`;
}

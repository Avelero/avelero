/**
 * Default size options.
 * Array order determines display order in popover.
 * displayHint is optional - used for stable sorting when mixing with brand sizes.
 */

export interface DefaultSize {
  name: string;
  displayHint: number; // 1-999, determines sort position in popover
}

// Letter sizes
export const letterSizes: DefaultSize[] = [
  { name: "3XS", displayHint: 10 },
  { name: "XXS", displayHint: 20 },
  { name: "XS", displayHint: 30 },
  { name: "S", displayHint: 40 },
  { name: "M", displayHint: 50 },
  { name: "L", displayHint: 60 },
  { name: "XL", displayHint: 70 },
  { name: "2XL", displayHint: 80 },
  { name: "3XL", displayHint: 90 },
  { name: "4XL", displayHint: 100 },
  { name: "5XL", displayHint: 110 },
];

// US Women's numeric
export const numericApparelSizes: DefaultSize[] = [
  { name: "00", displayHint: 200 },
  { name: "0", displayHint: 210 },
  { name: "2", displayHint: 220 },
  { name: "4", displayHint: 230 },
  { name: "6", displayHint: 240 },
  { name: "8", displayHint: 250 },
  { name: "10", displayHint: 260 },
  { name: "12", displayHint: 270 },
  { name: "14", displayHint: 280 },
  { name: "16", displayHint: 290 },
];

// Waist sizes
export const waistSizes: DefaultSize[] = [
  { name: "28", displayHint: 300 },
  { name: "29", displayHint: 310 },
  { name: "30", displayHint: 320 },
  { name: "31", displayHint: 330 },
  { name: "32", displayHint: 340 },
  { name: "33", displayHint: 350 },
  { name: "34", displayHint: 360 },
  { name: "36", displayHint: 370 },
  { name: "38", displayHint: 380 },
  { name: "40", displayHint: 390 },
  { name: "42", displayHint: 395 },
  { name: "44", displayHint: 398 },
];

// US Shoe sizes
export const usShoesSizes: DefaultSize[] = [
  { name: "5", displayHint: 400 },
  { name: "5.5", displayHint: 410 },
  { name: "6", displayHint: 420 },
  { name: "6.5", displayHint: 430 },
  { name: "7", displayHint: 440 },
  { name: "7.5", displayHint: 450 },
  { name: "8", displayHint: 460 },
  { name: "8.5", displayHint: 470 },
  { name: "9", displayHint: 480 },
  { name: "9.5", displayHint: 490 },
  { name: "10", displayHint: 500 },
  { name: "10.5", displayHint: 510 },
  { name: "11", displayHint: 520 },
  { name: "11.5", displayHint: 530 },
  { name: "12", displayHint: 540 },
  { name: "13", displayHint: 560 },
  { name: "14", displayHint: 580 },
  { name: "15", displayHint: 599 },
];

// EU Shoe sizes
export const euShoeSizes: DefaultSize[] = [
  { name: "35", displayHint: 600 },
  { name: "36", displayHint: 610 },
  { name: "37", displayHint: 620 },
  { name: "38", displayHint: 630 },
  { name: "39", displayHint: 640 },
  { name: "40", displayHint: 650 },
  { name: "41", displayHint: 660 },
  { name: "42", displayHint: 670 },
  { name: "43", displayHint: 680 },
  { name: "44", displayHint: 690 },
  { name: "45", displayHint: 700 },
  { name: "46", displayHint: 710 },
  { name: "47", displayHint: 720 },
  { name: "48", displayHint: 730 },
];

// UK Shoe sizes
export const ukShoeSizes: DefaultSize[] = [
  { name: "UK 3", displayHint: 800 },
  { name: "UK 3.5", displayHint: 810 },
  { name: "UK 4", displayHint: 820 },
  { name: "UK 4.5", displayHint: 830 },
  { name: "UK 5", displayHint: 840 },
  { name: "UK 5.5", displayHint: 850 },
  { name: "UK 6", displayHint: 860 },
  { name: "UK 6.5", displayHint: 870 },
  { name: "UK 7", displayHint: 880 },
  { name: "UK 7.5", displayHint: 890 },
  { name: "UK 8", displayHint: 900 },
  { name: "UK 8.5", displayHint: 910 },
  { name: "UK 9", displayHint: 920 },
  { name: "UK 10", displayHint: 940 },
  { name: "UK 11", displayHint: 960 },
  { name: "UK 12", displayHint: 980 },
];

// All defaults combined (ordered by displayHint)
export const allDefaultSizes: DefaultSize[] = [
  ...letterSizes,
  ...numericApparelSizes,
  ...waistSizes,
  ...usShoesSizes,
  ...euShoeSizes,
  ...ukShoeSizes,
].sort((a, b) => a.displayHint - b.displayHint);

// Set of default size names for quick lookup
export const defaultSizeNames = new Set(
  allDefaultSizes.map((s) => s.name.toLowerCase()),
);

// Helper to check if a size name is a default
export function isDefaultSize(name: string): boolean {
  return defaultSizeNames.has(name.toLowerCase());
}

// Helper to find default size by name
export function findDefaultSize(name: string): DefaultSize | undefined {
  return allDefaultSizes.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
}

// ============================================================================
// DEPRECATED: Backward compatibility exports (will be removed in Phase 3)
// ============================================================================

/**
 * @deprecated Use allDefaultSizes instead. Will be removed in Phase 3.
 * Grouped sizes for backward compatibility during migration.
 */
export const sizeGroups = {
  Letter: letterSizes,
  "US Numeric": numericApparelSizes,
  Waist: waistSizes,
  "US Shoe": usShoesSizes,
  "EU Shoe": euShoeSizes,
  "UK Shoe": ukShoeSizes,
} as const;

/**
 * @deprecated No longer needed - sizes don't use sortIndex anymore.
 * Will be removed in Phase 3.
 */
export function calculateCustomSortIndex(_referenceSortIndex: number): number {
  // This function is deprecated and will be removed
  // Custom sizes no longer need sortIndex
  return 0;
}

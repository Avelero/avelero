/**
 * Predefined size database.
 * Sort indexes use range-based system to prevent conflicts between size systems.
 *
 * Range allocation:
 * - Custom sizes: 0-999
 * - Letter sizes: 1000-1099
 * - US Numeric apparel: 2000-2099
 * - Waist sizes: 3000-3099
 * - US Shoe sizes: 4000-4199
 * - EU Shoe sizes: 5000-5199
 * - UK Shoe sizes: 6000-6199
 * - One Size options: 9000-9099
 */

export interface DefaultSize {
  name: string;
  sortIndex: number;
  group: string; // For UI grouping in the popover
}

// Letter sizes (1000-1100)
export const letterSizes: DefaultSize[] = [
  { name: "3XS", sortIndex: 1000, group: "Letter" },
  { name: "XXS", sortIndex: 1010, group: "Letter" },
  { name: "XS", sortIndex: 1020, group: "Letter" },
  { name: "S", sortIndex: 1030, group: "Letter" },
  { name: "M", sortIndex: 1040, group: "Letter" },
  { name: "L", sortIndex: 1050, group: "Letter" },
  { name: "XL", sortIndex: 1060, group: "Letter" },
  { name: "XXL", sortIndex: 1070, group: "Letter" },
  { name: "3XL", sortIndex: 1080, group: "Letter" },
  { name: "4XL", sortIndex: 1090, group: "Letter" },
  { name: "5XL", sortIndex: 1100, group: "Letter" },
];

// US Women's numeric (2000-2099)
export const numericApparelSizes: DefaultSize[] = [
  { name: "00", sortIndex: 2000, group: "US Numeric" },
  { name: "0", sortIndex: 2010, group: "US Numeric" },
  { name: "2", sortIndex: 2020, group: "US Numeric" },
  { name: "4", sortIndex: 2030, group: "US Numeric" },
  { name: "6", sortIndex: 2040, group: "US Numeric" },
  { name: "8", sortIndex: 2050, group: "US Numeric" },
  { name: "10", sortIndex: 2060, group: "US Numeric" },
  { name: "12", sortIndex: 2070, group: "US Numeric" },
  { name: "14", sortIndex: 2080, group: "US Numeric" },
  { name: "16", sortIndex: 2090, group: "US Numeric" },
];

// Waist sizes (3000-3099)
export const waistSizes: DefaultSize[] = [
  { name: "28", sortIndex: 3000, group: "Waist" },
  { name: "29", sortIndex: 3010, group: "Waist" },
  { name: "30", sortIndex: 3020, group: "Waist" },
  { name: "31", sortIndex: 3030, group: "Waist" },
  { name: "32", sortIndex: 3040, group: "Waist" },
  { name: "33", sortIndex: 3050, group: "Waist" },
  { name: "34", sortIndex: 3060, group: "Waist" },
  { name: "36", sortIndex: 3070, group: "Waist" },
  { name: "38", sortIndex: 3080, group: "Waist" },
  { name: "40", sortIndex: 3090, group: "Waist" },
  { name: "42", sortIndex: 3095, group: "Waist" },
  { name: "44", sortIndex: 3098, group: "Waist" },
];

// US Shoe sizes (4000-4199)
export const usShoesSizes: DefaultSize[] = [
  { name: "5", sortIndex: 4000, group: "US Shoe" },
  { name: "5.5", sortIndex: 4010, group: "US Shoe" },
  { name: "6", sortIndex: 4020, group: "US Shoe" },
  { name: "6.5", sortIndex: 4030, group: "US Shoe" },
  { name: "7", sortIndex: 4040, group: "US Shoe" },
  { name: "7.5", sortIndex: 4050, group: "US Shoe" },
  { name: "8", sortIndex: 4060, group: "US Shoe" },
  { name: "8.5", sortIndex: 4070, group: "US Shoe" },
  { name: "9", sortIndex: 4080, group: "US Shoe" },
  { name: "9.5", sortIndex: 4090, group: "US Shoe" },
  { name: "10", sortIndex: 4100, group: "US Shoe" },
  { name: "10.5", sortIndex: 4110, group: "US Shoe" },
  { name: "11", sortIndex: 4120, group: "US Shoe" },
  { name: "11.5", sortIndex: 4130, group: "US Shoe" },
  { name: "12", sortIndex: 4140, group: "US Shoe" },
  { name: "13", sortIndex: 4160, group: "US Shoe" },
  { name: "14", sortIndex: 4180, group: "US Shoe" },
  { name: "15", sortIndex: 4199, group: "US Shoe" },
];

// EU Shoe sizes (5000-5199)
export const euShoeSizes: DefaultSize[] = [
  { name: "35", sortIndex: 5000, group: "EU Shoe" },
  { name: "36", sortIndex: 5010, group: "EU Shoe" },
  { name: "37", sortIndex: 5020, group: "EU Shoe" },
  { name: "38", sortIndex: 5030, group: "EU Shoe" },
  { name: "39", sortIndex: 5040, group: "EU Shoe" },
  { name: "40", sortIndex: 5050, group: "EU Shoe" },
  { name: "41", sortIndex: 5060, group: "EU Shoe" },
  { name: "42", sortIndex: 5070, group: "EU Shoe" },
  { name: "43", sortIndex: 5080, group: "EU Shoe" },
  { name: "44", sortIndex: 5090, group: "EU Shoe" },
  { name: "45", sortIndex: 5100, group: "EU Shoe" },
  { name: "46", sortIndex: 5110, group: "EU Shoe" },
  { name: "47", sortIndex: 5120, group: "EU Shoe" },
  { name: "48", sortIndex: 5130, group: "EU Shoe" },
];

// UK Shoe sizes (6000-6199)
export const ukShoeSizes: DefaultSize[] = [
  { name: "UK 3", sortIndex: 6000, group: "UK Shoe" },
  { name: "UK 3.5", sortIndex: 6010, group: "UK Shoe" },
  { name: "UK 4", sortIndex: 6020, group: "UK Shoe" },
  { name: "UK 4.5", sortIndex: 6030, group: "UK Shoe" },
  { name: "UK 5", sortIndex: 6040, group: "UK Shoe" },
  { name: "UK 5.5", sortIndex: 6050, group: "UK Shoe" },
  { name: "UK 6", sortIndex: 6060, group: "UK Shoe" },
  { name: "UK 6.5", sortIndex: 6070, group: "UK Shoe" },
  { name: "UK 7", sortIndex: 6080, group: "UK Shoe" },
  { name: "UK 7.5", sortIndex: 6090, group: "UK Shoe" },
  { name: "UK 8", sortIndex: 6100, group: "UK Shoe" },
  { name: "UK 8.5", sortIndex: 6110, group: "UK Shoe" },
  { name: "UK 9", sortIndex: 6120, group: "UK Shoe" },
  { name: "UK 10", sortIndex: 6140, group: "UK Shoe" },
  { name: "UK 11", sortIndex: 6160, group: "UK Shoe" },
  { name: "UK 12", sortIndex: 6180, group: "UK Shoe" },
];

// Combined exports
export const allDefaultSizes: DefaultSize[] = [
  ...letterSizes,
  ...numericApparelSizes,
  ...waistSizes,
  ...usShoesSizes,
  ...euShoeSizes,
  ...ukShoeSizes,
];

// Grouped for UI display
export const sizeGroups = {
  Letter: letterSizes,
  "US Numeric": numericApparelSizes,
  Waist: waistSizes,
  "US Shoe": usShoesSizes,
  "EU Shoe": euShoeSizes,
  "UK Shoe": ukShoeSizes,
} as const;

// Helper to find a default size by name
export function findDefaultSize(name: string): DefaultSize | undefined {
  return allDefaultSizes.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
}

// Helper to calculate custom size sortIndex from a reference size
export function calculateCustomSortIndex(referenceSortIndex: number): number {
  // Extract relative position (0-999 range) to group custom sizes together
  return referenceSortIndex % 1000;
}

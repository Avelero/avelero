/*
  Predefined sizing systems for apparel industry.
  Single source of truth for size options across different systems.
  Size systems are category-dependent at level 2 (e.g., "mens-tops", "womens-bottoms").
*/

// Category-dependent default size systems (Level 2)
// Format: "gender-subcategory" (e.g., "mens-tops", "womens-bottoms")
export const defaultSizesByCategory = {
  // Men's Categories
  "mens-bottoms": ["28", "30", "32", "34", "36", "38", "40", "42"],
  "mens-outerwear": ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  "mens-tops": ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  "mens-footwear": [
    "7",
    "7.5",
    "8",
    "8.5",
    "9",
    "9.5",
    "10",
    "10.5",
    "11",
    "11.5",
    "12",
    "12.5",
    "13",
  ],

  // Women's Categories
  "womens-bottoms": ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16"],
  "womens-dresses": ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
  "womens-outerwear": ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
  "womens-tops": ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
  "womens-footwear": [
    "5",
    "5.5",
    "6",
    "6.5",
    "7",
    "7.5",
    "8",
    "8.5",
    "9",
    "9.5",
    "10",
    "10.5",
    "11",
  ],
} as const;

// Fallback sizes when no category is selected
const FALLBACK_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

// Helper: Extract level 2 category key from full category path
// Examples:
//   "Men's / Tops / Jerseys" -> "mens-tops"
//   "Women's / Bottoms" -> "womens-bottoms"
//   "Men's" -> null (not level 2)
export function getCategoryKey(categoryPath: string): string | null {
  if (!categoryPath || categoryPath === "Select category") {
    return null;
  }

  const parts = categoryPath.split(" / ").map((p) => p.trim());

  // Need at least 2 levels
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  // Convert to kebab-case key (e.g., "Men's" -> "mens", "Tops" -> "tops")
  const level1 = parts[0].toLowerCase().replace(/[']/g, "");
  const level2 = parts[1].toLowerCase().replace(/[']/g, "");

  return `${level1}-${level2}`;
}

// Helper: Get level 2 category display name from full path
// Examples:
//   "Men's / Tops / Jerseys" -> "Men's / Tops"
//   "Women's / Bottoms / Jeans" -> "Women's / Bottoms"
//   "Men's" -> "Men's"
export function getLevel2CategoryPath(categoryPath: string): string {
  if (!categoryPath || categoryPath === "Select category") {
    return "Select category";
  }

  const parts = categoryPath.split(" / ").map((p) => p.trim());

  // If already at level 1 or 2, return as is
  if (parts.length <= 2) {
    return categoryPath;
  }

  // Return first two levels
  return parts.slice(0, 2).join(" / ");
}

// Helper: Get default sizes for a category path
export function getSizesForCategory(categoryPath: string): readonly string[] {
  const categoryKey = getCategoryKey(categoryPath);

  if (!categoryKey) {
    // No valid category, return fallback sizes
    return FALLBACK_SIZES;
  }

  // Return category-specific sizes or fallback to generic sizes
  return (
    defaultSizesByCategory[categoryKey as CategorySizeKey] || FALLBACK_SIZES
  );
}

// Helper: Get all level 2 category keys with their display names
export function getAllLevel2Categories(): Array<{
  key: string;
  displayName: string;
}> {
  return [
    { key: "mens-bottoms", displayName: "Men's / Bottoms" },
    { key: "mens-outerwear", displayName: "Men's / Outerwear" },
    { key: "mens-tops", displayName: "Men's / Tops" },
    { key: "mens-footwear", displayName: "Men's / Footwear" },
    { key: "womens-bottoms", displayName: "Women's / Bottoms" },
    { key: "womens-dresses", displayName: "Women's / Dresses" },
    { key: "womens-outerwear", displayName: "Women's / Outerwear" },
    { key: "womens-tops", displayName: "Women's / Tops" },
    { key: "womens-footwear", displayName: "Women's / Footwear" },
  ];
}

export type CategorySizeKey = keyof typeof defaultSizesByCategory;

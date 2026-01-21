/**
 * Generates a URL-friendly handle from a product name.
 * Converts to lowercase, replaces spaces with dashes, and removes special characters.
 *
 * @example "Special Pants" → "special-pants"
 * @example "Organic Cotton T-Shirt (2024)" → "organic-cotton-t-shirt-2024"
 */
export function generateProductHandle(productName: string): string {
  return productName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and dashes
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

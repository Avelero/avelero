/**
 * Text Formatting Utilities
 */

/**
 * Truncate text to a specified length
 */
export function truncateText(text: string, maxLength: number): string {
  // Handle small or non-positive maxLength values
  if (maxLength <= 3) {
    return text.substring(0, Math.max(0, maxLength));
  }
  
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Format price with currency
 * - Rounds to nearest integer
 * - Uses space as thousands separator
 * - Example: 1350.50 -> "€ 1 351"
 */
export function formatPrice(
  price: string | number,
  currency = '€'
): string {
  // Convert to number and validate
  const numPrice = typeof price === 'number' ? price : Number.parseFloat(price);
  
  // Check if the parsed value is a finite number
  if (!Number.isFinite(numPrice)) {
    // Return safe fallback for invalid inputs
    return `${currency} 0`;
  }
  
  const roundedPrice = Math.round(numPrice);
  
  // Format with space as thousands separator
  const formattedPrice = roundedPrice.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  });
  
  return `${currency} ${formattedPrice}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value}%`;
}

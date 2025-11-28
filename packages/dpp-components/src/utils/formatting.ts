/**
 * Text and number formatting utilities
 */

export function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 3) {
    return text.substring(0, Math.max(0, maxLength));
  }

  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

export function formatPrice(price: string | number, currency = "€"): string {
  const numPrice = typeof price === "number" ? price : Number.parseFloat(price);
  if (!Number.isFinite(numPrice)) {
    return `${currency} 0`;
  }

  const roundedPrice = Math.round(numPrice);

  const formattedPrice = roundedPrice.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  });

  return `${currency} ${formattedPrice}`;
}

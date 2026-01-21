/**
 * Text and number formatting utilities
 */

function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 3) {
    return text.substring(0, Math.max(0, maxLength));
  }

  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Currency code to symbol mapping for common currencies.
 * Falls back to the currency code if not found.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  INR: "₹",
  BRL: "R$",
  MXN: "MX$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
  TWD: "NT$",
  THB: "฿",
  ZAR: "R",
  RUB: "₽",
  TRY: "₺",
  ILS: "₪",
  AED: "د.إ",
  SAR: "﷼",
};

/**
 * Get the currency symbol for a given currency code.
 * Returns the code itself if no symbol is found.
 */
export function getCurrencySymbol(currency: string): string {
  const upper = currency.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? currency;
}

/**
 * Format a price with the appropriate currency symbol.
 *
 * @param price - The price value (number or string)
 * @param currency - ISO 4217 currency code (e.g., "EUR", "USD") or symbol
 * @param roundPrice - Whether to round to whole numbers (default: true)
 * @returns Formatted price string (e.g., "€ 99" or "€ 99.50")
 */
export function formatPrice(
  price: string | number,
  currency = "EUR",
  roundPrice = true,
): string {
  const numPrice = typeof price === "number" ? price : Number.parseFloat(price);
  if (!Number.isFinite(numPrice)) {
    return "";
  }

  // Get the symbol (handles both codes like "EUR" and already-symbols like "€")
  const symbol = currency.length <= 1 ? currency : getCurrencySymbol(currency);

  if (roundPrice) {
    const rounded = Math.round(numPrice);
    const formatted = rounded.toLocaleString("en", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    });
    return `${symbol} ${formatted}`;
  }

  // Show 2 decimal places when not rounding
  const formatted = numPrice.toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
  return `${symbol} ${formatted}`;
}

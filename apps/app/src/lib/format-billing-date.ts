/**
 * Shared UTC date formatting for billing surfaces.
 */
const BILLING_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formats a billing timestamp in UTC so Stripe-backed dates stay stable.
 */
export function formatBillingDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return BILLING_DATE_FORMATTER.format(parsed);
}

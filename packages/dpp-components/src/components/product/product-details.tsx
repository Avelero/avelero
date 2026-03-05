/**
 * Product details table for article metadata and variant attributes.
 */
import type { ThemeConfig, VariantAttribute } from "@v1/dpp-components";
import { toExternalHref } from "../../lib/url-utils";

interface Props {
  articleNumber: string;
  manufacturer: string;
  manufacturerUrl?: string;
  countryOfOrigin: string;
  category: string;
  /** Variant attributes (0-3) */
  attributes?: VariantAttribute[];
  themeConfig: ThemeConfig;
}

function toCapitalizedLabel(value: string): string {
  // Normalize labels so capitalization controls in the theme editor work as expected.
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function ProductDetails({
  articleNumber,
  manufacturer,
  manufacturerUrl,
  countryOfOrigin,
  category,
  attributes = [],
  themeConfig,
}: Props) {
  // Build rows for non-empty values, including optional external links.
  void themeConfig;
  const articleNumberClickable = true;
  const normalizedManufacturerUrl = toExternalHref(manufacturerUrl);
  const manufacturerClickable = Boolean(normalizedManufacturerUrl);

  const rows: Array<{
    label: string;
    value: string;
    clickable?: boolean;
    href?: string;
    external?: boolean;
  }> = [];

  if (articleNumber) {
    rows.push({
      label: "Article Number",
      value: articleNumber,
      clickable: articleNumberClickable,
      href: "#article-number",
    });
  }

  if (manufacturer) {
    rows.push({
      label: "Manufacturer",
      value: manufacturer,
      clickable: manufacturerClickable,
      href: normalizedManufacturerUrl,
      external: true,
    });
  }

  if (countryOfOrigin) {
    rows.push({
      label: "Country Of Origin",
      value: countryOfOrigin,
    });
  }

  if (category) {
    rows.push({
      label: "Category",
      value: category,
    });
  }

  // Add variant attributes (max 3, enforced by data model)
  for (const attr of attributes.slice(0, 3)) {
    if (attr.value) {
      rows.push({
        label: toCapitalizedLabel(attr.name),
        value: attr.value,
      });
    }
  }

  // Don't render anything if no rows
  if (rows.length === 0) return null;

  return (
    <div className="w-full px-sm @3xl:px-0 mt-2x">
      <div className="product-details w-full border">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`product-details__row p-sm flex justify-between items-start ${
              index < rows.length - 1 ? "border-b" : ""
            }`}
          >
            <div className="product-details__label">{row.label}</div>
            <div className="product-details__value text-right">
              {row.clickable && row.href ? (
                <a
                  href={row.href}
                  className="cursor-pointer"
                  target={row.external ? "_blank" : undefined}
                  rel={row.external ? "noopener noreferrer" : undefined}
                >
                  {row.value}
                </a>
              ) : (
                <span>{row.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

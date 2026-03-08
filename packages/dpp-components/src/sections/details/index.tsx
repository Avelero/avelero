import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import { getCountryName } from "../_transforms";
import type { SectionProps } from "../registry";

function toCapitalizedLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function DetailsSection({ section, tokens, data }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const { productIdentifiers, productAttributes, manufacturing } = data;

  const manufacturer = manufacturing?.manufacturer;
  const normalizedManufacturerUrl = toExternalHref(manufacturer?.website);

  const rows: Array<{
    label: string;
    value: string;
    href?: string;
    external?: boolean;
  }> = [];

  if (productIdentifiers.articleNumber) {
    rows.push({
      label: "Article Number",
      value: productIdentifiers.articleNumber,
      href: "#article-number",
    });
  }

  if (manufacturer?.legalName) {
    rows.push({
      label: "Manufacturer",
      value: manufacturer.legalName,
      href: normalizedManufacturerUrl,
      external: true,
    });
  }

  if (manufacturer?.countryCode) {
    const countryName = getCountryName(manufacturer.countryCode);
    if (countryName) {
      rows.push({ label: "Country Of Origin", value: countryName });
    }
  }

  if (productAttributes.category?.category) {
    rows.push({
      label: "Category",
      value: productAttributes.category.category,
    });
  }

  for (const attr of (productAttributes.attributes ?? []).slice(0, 3)) {
    if (attr.value) {
      rows.push({ label: toCapitalizedLabel(attr.name), value: attr.value });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="w-full px-sm @3xl:px-0">
      <div className="w-full border" style={s.container}>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`p-sm flex justify-between items-start ${
              index < rows.length - 1 ? "border-b" : ""
            }`}
          >
            <div style={s.label}>{row.label}</div>
            <div className="text-right" style={s.value}>
              {row.href ? (
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

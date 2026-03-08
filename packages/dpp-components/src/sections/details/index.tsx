/**
 * Product details sidebar section.
 *
 * Renders the product metadata as two left-aligned columns under a labeled header.
 */

import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import { toExternalHref } from "../../lib/url-utils";
import { getCountryName } from "../_transforms";
import type { SectionProps } from "../registry";

function toCapitalizedLabel(value: string): string {
  // Normalize raw attribute names into editor-friendly labels.
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function DetailsSection({
  section,
  tokens,
  data,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve styles and map the product metadata into detail rows.
  const s = resolveStyles(section.styles, tokens);
  const { productIdentifiers, productAttributes, manufacturing } = data;

  const manufacturer = manufacturing?.manufacturer;
  const normalizedManufacturerUrl = toExternalHref(manufacturer?.website);
  const borderColor =
    s.row?.borderColor ?? s.header?.borderColor ?? s.container?.borderColor;
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const headerSelection = select("details.header");
  const headingSelection = select("details.heading");
  const rowSelection = select("details.row");
  const labelSelection = select("details.label");
  const valueSelection = select("details.value");

  const rows: Array<{
    key: string;
    label: string;
    value: string;
    href?: string;
    external?: boolean;
  }> = [];

  if (productIdentifiers.articleNumber) {
    rows.push({
      key: "article-number",
      label: "Article Number",
      value: productIdentifiers.articleNumber,
      href: "#article-number",
    });
  }

  if (manufacturer?.legalName) {
    rows.push({
      key: "manufacturer",
      label: "Manufacturer",
      value: manufacturer.legalName,
      href: normalizedManufacturerUrl,
      external: true,
    });
  }

  if (manufacturer?.countryCode) {
    const countryName = getCountryName(manufacturer.countryCode);
    if (countryName) {
      rows.push({
        key: "country-of-origin",
        label: "Country Of Origin",
        value: countryName,
      });
    }
  }

  if (productAttributes.category?.category) {
    rows.push({
      key: "category",
      label: "Category",
      value: productAttributes.category.category,
    });
  }

  for (const [index, attr] of (productAttributes.attributes ?? [])
    .slice(0, 3)
    .entries()) {
    if (attr.value) {
      rows.push({
        key: `attribute-${attr.name}-${index}`,
        label: toCapitalizedLabel(attr.name),
        value: attr.value,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div
      className={["flex flex-col w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        {...headerSelection}
        className="w-full border-b pb-xs"
        style={{ ...s.header, borderColor }}
      >
        <h2 
          {...headingSelection}
          className="w-fit"
          style={s.heading}>
          Details
        </h2>
      </div>

      <div className="grid w-full min-w-0 grid-cols-[minmax(120px,max-content)_minmax(0,1fr)]">
        {rows.map((row) => (
          <div
            key={row.key}
            {...rowSelection}
            className="col-span-2 grid min-w-0 border-b py-sm"
            style={{ borderColor, gridTemplateColumns: "subgrid" }}
          >
            <div className="min-w-0 pr-4">
              <div
                {...labelSelection}
                className="min-w-[120px] whitespace-nowrap"
                style={s.label}
              >
                {row.label}
              </div>
            </div>
            <div className="min-w-0">
              <div
                {...valueSelection}
                className="min-w-0 overflow-hidden whitespace-nowrap text-left text-ellipsis"
                style={s.value}
              >
                {row.href ? (
                  <a
                    href={row.href}
                    className="block truncate cursor-pointer"
                    target={row.external ? "_blank" : undefined}
                    rel={row.external ? "noopener noreferrer" : undefined}
                  >
                    {row.value}
                  </a>
                ) : (
                  <span className="block truncate">{row.value}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { ThemeConfig } from "@v1/dpp-components";

interface Props {
  articleNumber: string;
  manufacturer: string;
  countryOfOrigin: string;
  category: string;
  size: string;
  color: string;
  themeConfig: ThemeConfig;
}

export function ProductDetails({
  articleNumber,
  manufacturer,
  countryOfOrigin,
  category,
  size,
  color,
  themeConfig,
}: Props) {
  const articleNumberClickable = true;
  const manufacturerClickable = true;

  // Build rows array, filtering out empty values
  const rows: Array<{
    label: string;
    value: string;
    clickable?: boolean;
    href?: string;
  }> = [];

  if (articleNumber) {
    rows.push({
      label: "ARTICLE NUMBER",
      value: articleNumber,
      clickable: articleNumberClickable,
      href: "#article-number",
    });
  }

  if (manufacturer) {
    rows.push({
      label: "MANUFACTURER",
      value: manufacturer,
      clickable: manufacturerClickable,
      href: "#manufacturer",
    });
  }

  if (countryOfOrigin) {
    rows.push({
      label: "COUNTRY OF ORIGIN",
      value: countryOfOrigin,
    });
  }

  if (category) {
    rows.push({
      label: "CATEGORY",
      value: category,
    });
  }

  if (size) {
    rows.push({
      label: "SIZE",
      value: size,
    });
  }

  if (color) {
    rows.push({
      label: "COLOR",
      value: color,
    });
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
                <a href={row.href} className="cursor-pointer">
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

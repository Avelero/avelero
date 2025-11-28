import type { ThemeConfig } from "@v1/dpp-components";

interface Props {
  articleNumber: string;
  manufacturer: string;
  countryOfOrigin: string;
  category: string;
  size: string;
  color: string;
  themeConfig: ThemeConfig;
  isLast?: boolean;
}

export function ProductDetails({
  articleNumber,
  manufacturer,
  countryOfOrigin,
  category,
  size,
  color,
  themeConfig,
  isLast = false,
}: Props) {
  const articleNumberClickable = true;
  const manufacturerClickable = true;

  return (
    <div
      className={`w-full px-sm @3xl:px-0 pt-md pb-lg${isLast ? " pb-0" : ""}`}
    >
      <div className="product-details w-full border">
        {/* Article Number Row */}
        <div className="p-sm product-details__row flex justify-between items-start border-b">
          <div className="product-details__row-label">ARTICLE NUMBER</div>
          <div className="product-details__row-value text-right">
            {articleNumberClickable ? (
              <a
                href="#article-number"
                className="product-details__row-link cursor-pointer"
              >
                {articleNumber}
              </a>
            ) : (
              <span>{articleNumber}</span>
            )}
          </div>
        </div>

        {/* Manufacturer Row */}
        <div className="p-sm product-details__row flex justify-between items-start border-b">
          <div className="product-details__row-label">MANUFACTURER</div>
          <div className="product-details__row-value text-right">
            {manufacturerClickable ? (
              <a
                href="#manufacturer"
                className="cursor-pointer product-details__row-link"
              >
                {manufacturer}
              </a>
            ) : (
              <span>{manufacturer}</span>
            )}
          </div>
        </div>

        {/* Country of Origin Row */}
        <div className="p-sm product-details__row flex justify-between items-start border-b">
          <div className="product-details__row-label">COUNTRY OF ORIGIN</div>
          <div className="product-details__row-value text-right">
            {countryOfOrigin}
          </div>
        </div>

        {/* Category Row */}
        <div className="p-sm product-details__row flex justify-between items-start border-b">
          <div className="product-details__row-label">CATEGORY</div>
          <div className="product-details__row-value text-right">
            {category}
          </div>
        </div>

        {/* Size Row */}
        <div className="p-sm product-details__row flex justify-between items-start border-b">
          <div className="product-details__row-label">SIZE</div>
          <div className="product-details__row-value text-right">{size}</div>
        </div>

        {/* Color Row */}
        <div className="p-sm product-details__row flex justify-between items-start">
          <div className="product-details__row-label">COLOR</div>
          <div className="product-details__row-value text-right">{color}</div>
        </div>
      </div>
    </div>
  );
}

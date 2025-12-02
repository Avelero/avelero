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
        <div className="product-details__row p-sm flex justify-between items-start border-b">
          <div className="product-details__label">ARTICLE NUMBER</div>
          <div className="product-details__value text-right">
            {articleNumberClickable ? (
              <a href="#article-number" className="cursor-pointer">
                {articleNumber}
              </a>
            ) : (
              <span>{articleNumber}</span> 
            )}
          </div>
        </div>

        {/* Manufacturer Row */}
        <div className="product-details__row p-sm flex justify-between items-start border-b">
          <div className="product-details__label">MANUFACTURER</div>
          <div className="product-details__value text-right">
            {manufacturerClickable ? (
              <a href="#manufacturer" className="cursor-pointer">
                {manufacturer}
              </a>
            ) : (
              <span>{manufacturer}</span>
            )}
          </div>
        </div>

        {/* Country of Origin Row */}
        <div className="product-details__row p-sm flex justify-between items-start border-b">
          <div className="product-details__label">COUNTRY OF ORIGIN</div>
          <div className="product-details__value text-right">
            {countryOfOrigin}
          </div>
        </div>

        {/* Category Row */}
        <div className="product-details__row p-sm flex justify-between items-start border-b">
          <div className="product-details__label">CATEGORY</div>
          <div className="product-details__value text-right">
            {category}
          </div>
        </div>

        {/* Size Row */}
        <div className="product-details__row p-sm flex justify-between items-start border-b">
          <div className="product-details__label">SIZE</div>
          <div className="product-details__value text-right">{size}</div>
        </div>

        {/* Color Row */}
        <div className="product-details__row p-sm flex justify-between items-start">
          <div className="product-details__label">COLOR</div>
          <div className="product-details__value text-right">{color}</div>
        </div>
      </div>
    </div>
  );
}

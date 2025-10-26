import type { ThemeConfig } from '@/types/theme-config';

interface Props {
  articleNumber: string;
  manufacturer: string;
  countryOfOrigin: string;
  category: string;
  size: string;
  color: string;
  theme: ThemeConfig;
  isLast?: boolean;
}

export function ProductDetails({
  articleNumber,
  manufacturer,
  countryOfOrigin,
  category,
  size,
  color,
  theme,
  isLast = false,
}: Props) {
  const { colors } = theme;
  const articleNumberClickable = true;
  const manufacturerClickable = true;
  
  return (
    <div className={`w-full px-sm md:px-0 pt-md pb-lg${isLast ? ' pb-0' : ''}`}>
      {/* Article Number Row */}
      <div
        className="p-sm flex justify-between items-start border rounded-t-rounding"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          ARTICLE NUMBER
        </div>
        <div className="type-body-sm text-right">
          {articleNumberClickable ? (
            <a href="#article-number" className="cursor-pointer" style={{ color: colors.highlight }}>
              {articleNumber}
            </a>
          ) : (
            <span style={{ color: colors.primaryText }}>{articleNumber}</span>
          )}
        </div>
      </div>
      
      {/* Manufacturer Row */}
      <div
        className="p-sm flex justify-between items-start border-x border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          MANUFACTURER
        </div>
        <div className="type-body-sm text-right">
          {manufacturerClickable ? (
            <a href="#manufacturer" className="cursor-pointer" style={{ color: colors.highlight }}>
              {manufacturer}
            </a>
          ) : (
            <span style={{ color: colors.primaryText }}>{manufacturer}</span>
          )}
        </div>
      </div>
      
      {/* Country of Origin Row */}
      <div
        className="p-sm flex justify-between items-start border-x border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          COUNTRY OF ORIGIN
        </div>
        <div
          className="type-body-sm text-right"
          style={{ color: colors.secondaryText }}
        >
          {countryOfOrigin}
        </div>
      </div>
      
      {/* Category Row */}
      <div
        className="p-sm flex justify-between items-start border-x border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          CATEGORY
        </div>
        <div
          className="type-body-sm text-right"
          style={{ color: colors.secondaryText }}
        >
          {category}
        </div>
      </div>
      
      {/* Size Row */}
      <div
        className="p-sm flex justify-between items-start border-x border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          SIZE
        </div>
        <div
          className="type-body-sm text-right"
          style={{ color: colors.secondaryText }}
        >
          {size}
        </div>
      </div>
      
      {/* Color Row */}
      <div
        className="p-sm flex justify-between rounded-b-rounding items-start border-x border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="type-body-sm" style={{ color: colors.primaryText }}>
          COLOR
        </div>
        <div
          className="type-body-sm text-right"
          style={{ color: colors.secondaryText }}
        >
          {color}
        </div>
      </div>
    </div>
  );
}

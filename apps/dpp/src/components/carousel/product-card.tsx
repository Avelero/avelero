import type { ThemeConfig } from '@/types/theme-config';
import type { SimilarProduct } from '@/types/dpp-data';
import { formatPrice } from '@/lib/utils/formatting';

interface Props {
  product: SimilarProduct;
  theme: ThemeConfig;
  imageZoom?: number;
  imagePosition?: 'top' | 'center' | 'bottom';
}

export function ProductCard({ product, theme, imageZoom = 100, imagePosition = 'center' }: Props) {
  const { colors } = theme;
  
  // Convert zoom from percentage to scale value
  const zoomScale = Math.max(1, imageZoom / 100);
  
  // Determine positioning values
  let objectPosition = '50% 50%'; // Default: center
  let transformOrigin = '50% 50%'; // Default: center
  
  if (imagePosition === 'top') {
    objectPosition = '50% 0%';
    transformOrigin = '50% 0%';
  } else if (imagePosition === 'bottom') {
    objectPosition = '50% 100%';
    transformOrigin = '50% 100%';
  }
  
  return (
    <a
      href={product.url}
      className="flex flex-col gap-sm cursor-pointer w-full h-full"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="relative w-full overflow-hidden rounded-rounding" style={{ aspectRatio: '3/4' }}>
        <img
          src={product.image}
          alt={product.name}
          className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 ease-in-out"
          style={{
            objectPosition,
            transform: `scale(${zoomScale})`,
            transformOrigin,
          }}
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-micro">
        <div
          className="type-body truncate"
          style={{ color: colors.highlight }}
        >
          {product.name}
        </div>
        <div
          className="type-body"
          style={{ color: colors.primaryText }}
        >
          {formatPrice(product.price, product.currency)}
        </div>
      </div>
    </a>
  );
}



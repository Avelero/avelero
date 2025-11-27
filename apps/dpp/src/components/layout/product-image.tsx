import type { ThemeConfig } from '@v1/dpp-components';

interface Props {
  image: string;
  alt: string;
  themeConfig: ThemeConfig;
}

export function ProductImage({ image, alt, themeConfig }: Props) {
  const { images } = themeConfig;
  
  // Convert zoom from percentage to scale value
  const zoomScale = Math.max(1, images.productImageZoom / 100);
  
  // Determine positioning values
  let objectPosition = '50% 50%'; // Default: center
  let transformOrigin = '50% 50%'; // Default: center
  
  if (images.productImagePosition === 'top') {
    objectPosition = '50% 0%';
    transformOrigin = '50% 0%';
  } else if (images.productImagePosition === 'bottom') {
    objectPosition = '50% 100%';
    transformOrigin = '50% 100%';
  }
  
  return (
    <div
      className="product__image relative w-full border-b md:border overflow-hidden"
      style={{
        aspectRatio: '393 / 539',
      }}
    >
      {image ? (
        <img
          src={image}
          alt={alt}
          className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300"
          style={{
            objectPosition,
            transform: `scale(${zoomScale})`,
            transformOrigin,
          }}
          loading="lazy"
        />
      ) : (
        <div
          className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-accent"
        >
          <span className="type-body-sm text-secondary">
            No product image available
          </span>
        </div>
      )}
    </div>
  );
}


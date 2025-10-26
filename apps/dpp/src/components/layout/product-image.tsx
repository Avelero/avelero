import type { ThemeConfig } from '@/types/theme-config';

interface Props {
  image: string;
  alt: string;
  theme: ThemeConfig;
}

export function ProductImage({ image, alt, theme }: Props) {
  const { images, colors } = theme;
  
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
      className="relative w-full border-y md:border rounded-rounding overflow-hidden"
      style={{
        aspectRatio: '393 / 539',
        borderColor: colors.border,
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
          className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100"
        >
          <span style={{ color: colors.secondaryText }}>
            No product image available
          </span>
        </div>
      )}
    </div>
  );
}



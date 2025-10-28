import type { ThemeConfig } from '@/types/theme-config';
import type { DppData } from '@/types/dpp-data';
import { ImageAndInfo } from './image-and-info';
import { ProductCarousel } from '../carousel/product-carousel';
import { CTABanner } from '../cta/cta-banner';

interface Props {
  data: DppData;
  theme: ThemeConfig;
}

export function ContentFrame({ data, theme }: Props) {
  const { sections, images } = theme;
  
  return (
    <main className="flex-grow flex flex-col md:pt-lg w-full">
      <div className="flex flex-col">
        {/* Product image and information section */}
        <div className="max-w-container mx-auto w-full md:px-lg">
          <ImageAndInfo data={data} theme={theme} />
        </div>
        
        {/* Carousel wrapper */}
        {sections.showSimilarProducts && data.similarProducts?.length > 0 && (
          <div className="w-full relative overflow-visible">
            <ProductCarousel
              products={data.similarProducts}
              theme={theme}
              imageZoom={images.carouselImageZoom}
              imagePosition={images.carouselImagePosition}
            />
          </div>
        )}
        
        {/* Optional CTA Banner */}
        {sections.showCTABanner && (
          <div className="max-w-container mx-auto w-full md:px-lg">
            <CTABanner theme={theme} />
          </div>
        )}
      </div>
    </main>
  );
}



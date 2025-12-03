import type { DppData, ThemeConfig } from "@v1/dpp-components";
import { ProductCarousel } from "../carousel/product-carousel";
import { CTABanner } from "../cta/cta-banner";
import { ImageAndInfo } from "./image-and-info";

interface Props {
  data: DppData;
  themeConfig: ThemeConfig;
}

export function ContentFrame({ data, themeConfig }: Props) {
  const { sections, images } = themeConfig;

  return (
    <main className="flex-grow flex flex-col pb-xl @3xl:py-lg w-full">
      <div className="flex flex-col">
        {/* Product image and information section */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg">
          <ImageAndInfo data={data} themeConfig={themeConfig} />
        </div>

        {/* Carousel wrapper */}
        {sections.showSimilarProducts && data.similarProducts?.length > 0 && (
          <div className="w-full relative overflow-visible">
            <ProductCarousel
              products={data.similarProducts}
              themeConfig={themeConfig}
              imageZoom={images.carouselImageZoom}
              imagePosition={images.carouselImagePosition}
            />
          </div>
        )}

        {/* Optional CTA Banner */}
        {sections.showCTABanner && (
          <div className="max-w-container mx-auto w-full @3xl:px-lg">
            <CTABanner themeConfig={themeConfig} />
          </div>
        )}
      </div>
    </main>
  );
}

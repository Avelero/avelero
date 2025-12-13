import type { DppContent, DppData, ThemeConfig } from "@v1/dpp-components";
import { ProductCarousel } from "../carousel/product-carousel";
import { CTABanner } from "../cta/cta-banner";
import { ImageAndInfo } from "./image-and-info";

interface Props {
  data: DppData;
  content?: DppContent;
  themeConfig: ThemeConfig;
}

export function ContentFrame({ data, content, themeConfig }: Props) {
  const { sections } = themeConfig;
  const similarProducts = content?.similarProducts ?? [];

  return (
    <main className="flex-grow flex flex-col pb-xl @3xl:py-lg w-full">
      <div className="flex flex-col">
        {/* Product image and information section */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg">
          <ImageAndInfo data={data} themeConfig={themeConfig} />
        </div>

        {/* Carousel wrapper */}
        {sections.showSimilarProducts && similarProducts.length > 0 && (
          <div className="w-full relative overflow-visible">
            <ProductCarousel
              products={similarProducts}
              themeConfig={themeConfig}
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

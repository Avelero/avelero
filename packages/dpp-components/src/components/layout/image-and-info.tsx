import type { DppData, ThemeConfig } from "@v1/dpp-components";
import { InformationFrame } from "./information-frame";
import { ProductImage } from "./product-image";

interface Props {
  data: DppData;
  themeConfig: ThemeConfig;
}

export function ImageAndInfo({ data, themeConfig }: Props) {
  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 @3xl:gap-lg w-full">
      {/* Product Image Section */}
      <div className="w-full">
        <div className="@3xl:sticky @3xl:top-[95.6px]">
          <ProductImage
            image={data.productImage}
            alt={`${data.brandName} ${data.title}`}
          />
        </div>
      </div>

      {/* Product Information Section */}
      <div className="@3xl:flex @3xl:justify-end @3xl:w-full">
        <div className="@3xl:w-5/6">
          <InformationFrame data={data} themeConfig={themeConfig} />
        </div>
      </div>
    </div>
  );
}

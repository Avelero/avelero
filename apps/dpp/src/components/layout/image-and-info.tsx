import type { ThemeConfig, DppData } from '@v1/dpp-components';
import { ProductImage } from './product-image';
import { InformationFrame } from './information-frame';

interface Props {
  data: DppData;
  themeConfig: ThemeConfig;
}

export function ImageAndInfo({ data, themeConfig }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-lg w-full">
      {/* Product Image Section */}
      <div className="w-full">
        <div className="md:sticky md:top-[95.6px]">
          <ProductImage
            image={data.productImage}
            alt={`${data.brandName} ${data.title}`}
            themeConfig={themeConfig}
          />
        </div>
      </div>
      
      {/* Product Information Section */}
      <div className="md:flex md:justify-end md:w-full">
        <div className="md:w-5/6">
          <InformationFrame data={data} themeConfig={themeConfig} />
        </div>
      </div>
    </div>
  );
}


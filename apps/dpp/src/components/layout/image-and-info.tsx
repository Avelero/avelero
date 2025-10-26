import type { ThemeConfig } from '@/types/theme-config';
import type { DppData } from '@/types/dpp-data';
import { ProductImage } from './product-image';
import { InformationFrame } from './information-frame';

interface Props {
  data: DppData;
  theme: ThemeConfig;
}

export function ImageAndInfo({ data, theme }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-lg w-full">
      {/* Product Image Section */}
      <div className="w-full">
        <div className="md:sticky md:top-[95.6px]">
          <ProductImage
            image={data.productImage}
            alt={`${data.brand} ${data.title}`}
            theme={theme}
          />
        </div>
      </div>
      
      {/* Product Information Section */}
      <div className="md:flex md:justify-end md:w-full">
        <div className="md:w-5/6">
          <InformationFrame data={data} theme={theme} />
        </div>
      </div>
    </div>
  );
}



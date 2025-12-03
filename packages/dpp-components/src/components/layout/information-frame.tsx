import type { DppData, ThemeConfig } from "@v1/dpp-components";
import { ImpactFrame } from "../impact/impact-frame";
import { JourneyFrame } from "../journey/journey-frame";
import { MaterialsFrame } from "../materials/materials-frame";
import { MenuFrame } from "../navigation/menu-frame";
import { ProductDescription } from "../product/product-description";
import { ProductDetails } from "../product/product-details";

interface Props {
  data: DppData;
  themeConfig: ThemeConfig;
}

export function InformationFrame({ data, themeConfig }: Props) {
  const { sections } = themeConfig;

  return (
    <div className="flex flex-col overflow-x-hidden relative @3xl:ml-auto @3xl:w-full">
      {/* Product Description Section */}
      <ProductDescription
        brand={data.brandName}
        title={data.title}
        description={data.description}
        themeConfig={themeConfig}
      />

      {/* Product Details Section */}
      {sections.showProductDetails && (
        <ProductDetails
          articleNumber={data.articleNumber}
          manufacturer={data.manufacturer}
          countryOfOrigin={data.countryOfOrigin}
          category={data.category}
          size={data.size}
          color={data.color}
          themeConfig={themeConfig}
        />
      )}

      {/* Primary Menu Section */}
      {sections.showPrimaryMenu && themeConfig.menus.primary.length > 0 && (
        <MenuFrame
          menuItems={themeConfig.menus.primary}
          themeConfig={themeConfig}
          variant="primary"
        />
      )}

      {/* Impact Section */}
      {sections.showImpact &&
        (data.impactMetrics.length > 0 || data.impactClaims.length > 0) && (
          <ImpactFrame
            metrics={data.impactMetrics}
            claims={data.impactClaims}
          />
        )}

      {/* Materials Section */}
      {sections.showMaterials && data.materials.length > 0 && (
        <MaterialsFrame
          materials={data.materials}
          themeConfig={themeConfig}
        />
      )}

      {/* Journey Section */}
      {sections.showJourney && data.journey.length > 0 && (
        <JourneyFrame
          journey={data.journey}
          themeConfig={themeConfig}
        />
      )}

      {/* Secondary Menu Section */}
      {sections.showSecondaryMenu && themeConfig.menus.secondary.length > 0 && (
        <MenuFrame
          menuItems={themeConfig.menus.secondary}
          themeConfig={themeConfig}
          variant="secondary"
        />
      )}
    </div>
  );
}

import type { ThemeConfig } from '@/types/theme-config';
import type { DppData } from '@/types/dpp-data';
import { ProductDescription } from '../product/product-description';
import { ProductDetails } from '../product/product-details';
import { MenuFrame } from '../navigation/menu-frame';
import { ImpactFrame } from '../impact/impact-frame';
import { MaterialsFrame } from '../materials/materials-frame';
import { JourneyFrame } from '../journey/journey-frame';

interface Props {
  data: DppData;
  theme: ThemeConfig;
}

export function InformationFrame({ data, theme }: Props) {
  const { sections } = theme;
  
  // Determine which sections are visible and which is last
  const visibleSections = [
    sections.showProductDetails && 'ProductDetails',
    sections.showPrimaryMenu && theme.menus.primary.length > 0 && 'PrimaryMenu',
    sections.showImpact && (data.impactMetrics.length > 0 || data.impactClaims.length > 0) && 'Impact',
    sections.showMaterials && data.materials.length > 0 && 'Materials',
    sections.showJourney && data.journey.length > 0 && 'Journey',
    sections.showSecondaryMenu && theme.menus.secondary.length > 0 && 'SecondaryMenu',
  ].filter(Boolean);
  
  const lastSection = visibleSections[visibleSections.length - 1];
  
  return (
    <div className="flex flex-col overflow-x-hidden relative md:ml-auto md:w-full">
      {/* Product Description Section */}
      <ProductDescription
        brand={data.brand}
        title={data.title}
        description={data.description}
        theme={theme}
        isLast={false}
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
          theme={theme}
          isLast={lastSection === 'ProductDetails'}
        />
      )}
      
      {/* Primary Menu Section */}
      {sections.showPrimaryMenu && theme.menus.primary.length > 0 && (
        <MenuFrame
          menuItems={theme.menus.primary}
          theme={theme}
          isLastMenu={lastSection === 'PrimaryMenu'}
        />
      )}
      
      {/* Impact Section */}
      {sections.showImpact && (data.impactMetrics.length > 0 || data.impactClaims.length > 0) && (
        <ImpactFrame
          metrics={data.impactMetrics}
          claims={data.impactClaims}
          theme={theme}
          isLast={lastSection === 'Impact'}
        />
      )}
      
      {/* Materials Section */}
      {sections.showMaterials && data.materials.length > 0 && (
        <MaterialsFrame
          materials={data.materials}
          theme={theme}
          isLast={lastSection === 'Materials'}
        />
      )}
      
      {/* Journey Section */}
      {sections.showJourney && data.journey.length > 0 && (
        <JourneyFrame
          journey={data.journey}
          theme={theme}
          isLast={lastSection === 'Journey'}
        />
      )}
      
      {/* Secondary Menu Section */}
      {sections.showSecondaryMenu && theme.menus.secondary.length > 0 && (
        <MenuFrame
          menuItems={theme.menus.secondary}
          theme={theme}
          isLastMenu={lastSection === 'SecondaryMenu'}
        />
      )}
    </div>
  );
}



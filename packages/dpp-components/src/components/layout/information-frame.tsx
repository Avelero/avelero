import type { DppData, ThemeConfig } from "@v1/dpp-components";
import { countries } from "@v1/selections";
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
  const {
    productIdentifiers,
    productAttributes,
    environmental,
    materials,
    manufacturing,
  } = data;

  // Helper function to get country name from code
  const getCountryName = (code: string | undefined): string => {
    if (!code) return "";
    const country = countries[code.toUpperCase() as keyof typeof countries];
    return country?.name ?? code;
  };

  // Build impact metrics from environmental data
  const impactMetrics = [];
  if (environmental?.carbonEmissions) {
    impactMetrics.push({
      type: "Carbon Footprint",
      value: String(environmental.carbonEmissions.value),
      unit: environmental.carbonEmissions.unit,
      icon: "leaf" as const,
    });
  }
  if (environmental?.waterUsage) {
    impactMetrics.push({
      type: "Water Usage",
      value: String(environmental.waterUsage.value),
      unit: environmental.waterUsage.unit,
      icon: "drop" as const,
    });
  }

  // Transform materials for display
  const displayMaterials =
    materials?.composition?.map((m) => ({
      percentage: m.percentage,
      type: m.material,
      origin: getCountryName(m.countryOfOrigin) || m.countryOfOrigin || "",
      certification: m.certification?.type,
      certificationUrl: undefined, // No URL in new structure
    })) ?? [];

  // Transform journey/supply chain for display - group by process step
  const journeyMap = new Map<
    string,
    {
      id: string;
      name: string;
      companies: Array<{ name: string; location: string }>;
    }
  >();

  for (const step of manufacturing?.supplyChain ?? []) {
    const processStep = step.processStep ?? "Unknown Step";
    const existing = journeyMap.get(processStep);
    const company = {
      name: step.operator.legalName,
      location: [
        step.operator.city,
        getCountryName(step.operator.countryCode) || step.operator.countryCode,
      ]
        .filter(Boolean)
        .join(", "),
    };

    if (existing) {
      existing.companies.push(company);
    } else {
      journeyMap.set(processStep, {
        id: processStep,
        name: processStep,
        companies: [company],
      });
    }
  }

  const journey = Array.from(journeyMap.values());

  return (
    <div className="flex flex-col overflow-x-hidden relative @3xl:ml-auto @3xl:w-full">
      {/* Product Description Section */}
      <ProductDescription
        brand={productAttributes.brand}
        title={productIdentifiers.productName}
        description={productAttributes.description ?? ""}
        themeConfig={themeConfig}
      />

      {/* Product Details Section */}
      {sections.showProductDetails && (
        <ProductDetails
          articleNumber={productIdentifiers.articleNumber}
          manufacturer={manufacturing?.manufacturer?.name ?? ""}
          countryOfOrigin={
            getCountryName(manufacturing?.manufacturer?.countryCode) || ""
          }
          category={productAttributes.category?.category ?? ""}
          attributes={productAttributes.attributes}
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
      {sections.showImpact && impactMetrics.length > 0 && (
        <ImpactFrame metrics={impactMetrics} />
      )}

      {/* Materials Section */}
      {sections.showMaterials && displayMaterials.length > 0 && (
        <MaterialsFrame
          materials={displayMaterials}
          themeConfig={themeConfig}
        />
      )}

      {/* Journey Section */}
      {sections.showJourney && journey.length > 0 && (
        <JourneyFrame journey={journey} themeConfig={themeConfig} />
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

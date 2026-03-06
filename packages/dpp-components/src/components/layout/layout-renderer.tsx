/**
 * Zone-based layout renderer.
 *
 * Replaces the fixed ImageAndInfo + InformationFrame rendering with a
 * flexible system where component instances are placed in zones.
 */

import type { DppContent, DppData, ThemeConfig } from "@v1/dpp-components";
import {
  getCountryName,
  transformImpactMetrics,
  transformJourney,
  transformMaterials,
} from "../../lib/dpp-data-transformers";
import type { LayoutComponentInstance } from "../../types/layout-config";
import { ProductCarousel } from "../carousel/product-carousel";
import { CTABanner } from "../cta/cta-banner";
import { ImpactFrame } from "../impact/impact-frame";
import { JourneyFrame } from "../journey/journey-frame";
import { MaterialsFrame } from "../materials/materials-frame";
import { MenuFrame } from "../navigation/menu-frame";
import { ProductDescription } from "../product/product-description";
import { ProductDetails } from "../product/product-details";
import { ProductImage } from "./product-image";

interface Props {
  data: DppData;
  content?: DppContent;
  themeConfig: ThemeConfig;
}

export function LayoutRenderer({ data, content, themeConfig }: Props) {
  const { layout, sections } = themeConfig;
  const { zones } = layout;

  // Pre-compute transformed data once for all instances
  const impactMetrics = transformImpactMetrics(data);
  const displayMaterials = transformMaterials(data);
  const journey = transformJourney(data);
  const similarProducts = content?.similarProducts ?? [];

  function renderInstance(instance: LayoutComponentInstance) {
    // Apply instance-level style overrides as CSS variables on a wrapper
    const styleOverrides = instance.styles
      ? Object.fromEntries(
          Object.entries(instance.styles).map(([key, value]) => [
            `--${key}`,
            value,
          ]),
        )
      : undefined;

    const rendered = renderComponentType(instance);
    if (!rendered) return null;

    return (
      <div key={instance.id} style={styleOverrides}>
        {rendered}
      </div>
    );
  }

  function renderComponentType(instance: LayoutComponentInstance) {
    const instanceContent = instance.content as
      | Record<string, unknown>
      | undefined;

    switch (instance.componentType) {
      case "image":
        return (
          <ProductImage
            image={data.productIdentifiers.productImage}
            alt={`${data.productAttributes.brand} ${data.productIdentifiers.productName}`}
          />
        );

      case "hero":
        return (
          <ProductDescription
            brand={data.productAttributes.brand}
            title={data.productIdentifiers.productName}
            description={data.productAttributes.description ?? ""}
            themeConfig={themeConfig}
          />
        );

      case "details":
        return (
          <ProductDetails
            articleNumber={data.productIdentifiers.articleNumber}
            manufacturer={data.manufacturing?.manufacturer?.name ?? ""}
            manufacturerUrl={data.manufacturing?.manufacturer?.website}
            countryOfOrigin={
              getCountryName(data.manufacturing?.manufacturer?.countryCode) ||
              ""
            }
            category={data.productAttributes.category?.category ?? ""}
            attributes={data.productAttributes.attributes}
            themeConfig={themeConfig}
          />
        );

      case "buttons": {
        const items =
          (instanceContent?.items as Array<{ label: string; url: string }>) ??
          [];
        const variant =
          (instanceContent?.variant as "primary" | "secondary") ?? "primary";
        if (items.length === 0) return null;
        return (
          <MenuFrame
            menuItems={items}
            themeConfig={themeConfig}
            variant={variant}
          />
        );
      }

      case "impact":
        if (impactMetrics.length === 0) return null;
        return <ImpactFrame metrics={impactMetrics} />;

      case "materials":
        if (displayMaterials.length === 0) return null;
        return (
          <MaterialsFrame
            materials={displayMaterials}
            themeConfig={themeConfig}
          />
        );

      case "journey":
        if (journey.length === 0) return null;
        return <JourneyFrame journey={journey} themeConfig={themeConfig} />;

      case "banner":
        return <CTABanner themeConfig={themeConfig} />;

      default:
        return null;
    }
  }

  return (
    <main className="flex-grow flex flex-col pb-xl @3xl:py-lg w-full">
      <div className="flex flex-col">
        {/* Two-column grid: left + right zones */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 @3xl:gap-lg w-full">
            {/* Left column */}
            <div className="w-full">
              <div className="@3xl:sticky @3xl:top-[96px] flex flex-col gap-2x">
                {zones["column-left"].map((instance) =>
                  renderInstance(instance),
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="@3xl:flex @3xl:justify-end @3xl:w-full">
              <div className="@3xl:w-5/6">
                <div className="flex flex-col gap-2x overflow-x-hidden relative @3xl:ml-auto @3xl:w-full">
                  {zones["column-right"].map((instance) =>
                    renderInstance(instance),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel (not part of layout zones yet, kept as-is) */}
        {sections.showSimilarProducts && similarProducts.length > 0 && (
          <div className="w-full relative overflow-visible">
            <ProductCarousel
              products={similarProducts}
              themeConfig={themeConfig}
            />
          </div>
        )}

        {/* Content zone (below the grid) */}
        <div className="max-w-container mx-auto w-full @3xl:px-lg flex flex-col gap-2x">
          {zones.content.map((instance) => renderInstance(instance))}
        </div>
      </div>
    </main>
  );
}

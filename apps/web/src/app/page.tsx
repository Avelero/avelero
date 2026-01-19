import { BentoBlock } from "@/components/bento-block";
import { ComplianceBlock } from "@/components/compliance-block";
import {
  FeatureBlock,
  FeatureBlockContent,
  FeatureBlockImage,
} from "@/components/feature-block";
import { FeatureCard, FeatureCards } from "@/components/feature-cards";
import { Hero } from "@/components/hero";
import { HeroImage } from "@/components/hero-image";
import { TextBlock } from "@/components/text-block";

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Avelero | Product passports that engage",
    description:
      "Avelero is built for fashion brands that want to launch EU-compliant product passports in days, not months.",
    url: "https://avelero.com",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Avelero",
      applicationCategory: "BusinessApplication",
      description:
        "Digital product passport platform for fashion brands with product footprint LCA engine, API-integrations, and customizable templates.",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
        <Hero />
        <HeroImage />
        <TextBlock
          spanText="Avelero is purpose-built for brands that are customer obsessed."
          text="Product passports are the last step in your customer journey — we believe this is an opportunity to delight."
        />
        <FeatureCards>
          <FeatureCard
            title="Extend the product lifecycle"
            description="Embed care guides, repair services, and resale options directly in the passport. Keep products in use and customers returning long after purchase."
            backgroundImage="/passport-menu-image.webp"
          />
          <FeatureCard
            title="Re-engage your customers"
            description="Tell your story, share your impact, and build loyalty. Product passports become part of the brand experience."
            backgroundImage="/passport-banner-image.webp"
          />
          <FeatureCard
            title="Drive traffic back to your store"
            description="Link to related products, promote campaigns, or capture newsletter signups directly from your product passport."
            backgroundImage="/passport-carousel-image.webp"
          />
        </FeatureCards>
        <FeatureBlock id="footprint">
          <FeatureBlockImage
            image="/lca-engine-image.webp"
            imageAlt="LCA engine illustration"
            topTitle="Estimate your product footprint"
            bottomTitle="with our LCA engine"
          />
          <FeatureBlockContent
            className="order-last md:order-first"
            topTitle="Estimate your product footprint"
            bottomTitle="with our LCA engine"
            description="Our LCA engine calculates carbon and water impact from your material and production data. Using validated open data sources and cradle-to-gate methodology, it gives you estimates ready to include in your digital product passports."
          />
        </FeatureBlock>
        <FeatureBlock id="designer">
          <FeatureBlockImage
            image="/customize-template-image.webp"
            imageAlt="Customize template illustration"
            topTitle="Design passports"
            bottomTitle="that feel like your brand"
          />
          <FeatureBlockContent
            topTitle="Design passports"
            bottomTitle="that feel like your brand"
            description="Build passports from modular sections that you can rearrange, style, and brand. Set your own typography, colors, and layout rules, then reuse them across your entire catalog. Every passport reflects your identity, not ours."
          />
        </FeatureBlock>
        <BentoBlock />
        <ComplianceBlock />
      </main>
    </>
  );
}

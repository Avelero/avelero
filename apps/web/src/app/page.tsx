import { Hero } from "@/components/hero";
import { HeroImage } from "@/components/hero-image";
import { Brands, BrandCard } from "@/components/brand-cards";
import { PlytixLogo, ShopifyLogo, ItsPerfectLogo, ApparelMagicLogo, AkeneoLogo, DelogueLogo } from "@/components/logos";
import { FeatureCards, FeatureCard } from "@/components/feature-cards";
import { PassportMenu } from "@/components/showcase/passport-menu";
import { PassportBanner } from "@/components/showcase/passport-banner";
import { TextBlock } from "@/components/text-block";
import { FeatureBlock, FeatureBlockContent, FeatureBlockImage } from "@/components/feature-block";
import { ComplianceBlock } from "@/components/compliance-block";
import { BentoBlock } from "@/components/bento-block";

export default function Page() {
  return (
    <div className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Hero />
      <HeroImage />
      <Brands>
        <BrandCard logo={<PlytixLogo height={24} color="hsl(var(--foreground))" />} />
        <BrandCard logo={<ShopifyLogo height={28} color="hsl(var(--foreground))" />} />
        <BrandCard logo={<ItsPerfectLogo height={28} color="hsl(var(--foreground))" />} />
        <BrandCard logo={<ApparelMagicLogo height={22} color="hsl(var(--foreground))" />} />
        <BrandCard logo={<AkeneoLogo height={20} color="hsl(var(--foreground))" />} />
        <BrandCard logo={<DelogueLogo height={24} color="hsl(var(--foreground))" />} />
      </Brands>
      <FeatureCards>
        <FeatureCard
          title="A reason to visit your DPP"
          description="Add care guides, repair services, and resell opportunities. Give customers a reason to return long after the purchase."
          backgroundImage="/feature-card-1.webp"
        >
          <PassportMenu />
        </FeatureCard>
        <FeatureCard
          title="Re-engage with your brand"
          description="Tell your story, share your impact, and build loyalty. Product passports are an extension of your brand."
          backgroundImage="/feature-card-2.webp"
        >
          <PassportBanner />
        </FeatureCard>
        <FeatureCard
          title="An opportunity to convert "
          description="Drive traffic back to your store with links to related products, newsletter signups, or campaign banners."
          backgroundImage="/feature-card-3.webp"
        >
          <PassportMenu />
        </FeatureCard>
      </FeatureCards>
      <TextBlock spanText="Avelero is built for fashion brands" text="that want to get compliant fast. Extensive integrations, AI-powered carbon estimates, and custom themes get your passports published in days." />
      <FeatureBlock>
        <FeatureBlockContent
          topTitle="Estimate your product footprint"
          bottomTitle="with our LCA engine"
          description="Our LCA engine calculates carbon and water impact from your material and production data. Using validated open data sources and cradle-to-gate methodology, it gives you estimates ready to include in your digital product passports."
        />
        <FeatureBlockImage image="/feature-section-1.webp" />
      </FeatureBlock>
      <FeatureBlock>
        <FeatureBlockImage image="/feature-section-2.webp" />
        <FeatureBlockContent
          topTitle="Designed to engage,"
          bottomTitle="modular & customizable"
          description="Build passports from modular sections that you can rearrange, style, and brand. Set your own typography, colors, and layout rules, then reuse them across your entire catalog. Every passport reflects your identity, not ours."
        />
      </FeatureBlock>
      <BentoBlock />
      <ComplianceBlock />
    </div>
  );
}

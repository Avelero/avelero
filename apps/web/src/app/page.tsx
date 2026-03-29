import { BentoBlock } from "@/components/bento-block";
import { ComplianceBlock } from "@/components/compliance-block";
import {
  FeatureBlock,
  FeatureBlockContent,
  FeatureBlockImage,
} from "@/components/feature-block";
import { FeatureCard, FeatureCards } from "@/components/feature-cards";
import { Hero, HeroHeadline, HeroAccent, HeroContent } from "@/components/hero";
import { HeroImage } from "@/components/hero-image";
import { ContactDrawer } from "@/components/contact-drawer";
import { Button } from "@/components/button";
import { Icons } from "@v1/ui/icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://avelero.com/",
  },
};

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
        <Hero>
          <HeroHeadline>
            Product passpo<span className="tracking-wide">rt</span>s that{" "}
            <HeroAccent>engage</HeroAccent>
          </HeroHeadline>
          <HeroContent
            description={
              <>
                <span className="text-foreground">
                  Avelero is built for fashion brands
                </span>{" "}
                that want to launch EU-compliant product passports in days, not
                months. Connect your article data, estimate product footprints, and
                design on-brand experiences that customers actually want to explore.
              </>
            }
          >
            <ContactDrawer />
            <Button asChild>
              <a
                href="https://passport.avelero.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open live digital product passport in new tab"
              >
                <span>Live passport</span>
                <Icons.SquareArrowOutUpRight color="var(--foreground)" />
              </a>
            </Button>
          </HeroContent>
        </Hero>
        <HeroImage />
        <FeatureCards
          title="A new customer touchpoint"
          href="/digital-product-passport/"
        >
          <FeatureCard
            title="A reason to visit your passport"
            description="Add care guides, repair services, and resell opportunities. Give customers a reason to return long after the purchase."
            backgroundImage="/passport-buttons.webp"
          />
          <FeatureCard
            title="Re-engage with your brand"
            description="Tell your story, share your impact, and build loyalty. Product passports are an extension of your brand."
            backgroundImage="/passport-banner.webp"
          />
          <FeatureCard
            title="An opportunity to convert"
            description="Drive traffic back to your store with links to related products, newsletter signups, or campaign banners."
            backgroundImage="/passport-storyblocks.webp"
          />
        </FeatureCards>
        <FeatureBlock id="footprint">
          <FeatureBlockImage
            image="/lca-engine.webp"
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
            image="/passport-designer.webp"
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

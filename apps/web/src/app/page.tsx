import { ComplianceBlock } from "@/components/compliance-block";
import { FaqBlock } from "@/components/faq-block";
import { RelatedUpdates } from "@/components/related-updates";
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

const FAQ_ITEMS = [
  {
    question: "What is a digital product passport?",
    answer:
      "A digital product passport (DPP) is a product-level digital record containing information about a product's materials, origin, environmental impact, and end-of-life options. Consumers access it by scanning a QR code on the product label or packaging.",
  },
  {
    question: "Who is Avelero built for?",
    answer:
      "Avelero is built for fashion and apparel brands that want to launch EU-compliant digital product passports. Whether you're an emerging label or an enterprise brand, you can connect your product data, estimate footprints, and design on-brand passport experiences.",
  },
  {
    question: "When are digital product passports mandatory?",
    answer:
      "The EU's Ecodesign for Sustainable Products Regulation (ESPR) was adopted in 2024. Textile-specific requirements are expected to be adopted in 2027, with an 18-month transition period, meaning brands selling in the EU should be ready by 2028-2029.",
  },
  {
    question: "How does Avelero estimate product footprints?",
    answer:
      "Our built-in LCA engine uses a machine learning model trained on validated open data sources and ISO 14040/14044 methodology. It can predict carbon and water impact from as little as a product category and basic material info, so you don't need complete data to get started.",
  },
  {
    question: "Can I customize how my passports look?",
    answer:
      "Yes. You have full control over typography, colors, layout, and content sections. Every passport is designed to match your brand identity, not a generic compliance page.",
  },
  {
    question: "How do I get my product data into Avelero?",
    answer:
      "You can upload Excel files, PDFs, or other product data directly, or connect via API to your PLM, ERP, or e-commerce platform. Avelero also uses AI to detect and fill gaps in your data automatically.",
  },
  {
    question: "How long does it take to go live?",
    answer:
      "Most brands go from raw data to live passports in days, not months. Connect your data, estimate footprints, design your passport, and publish with QR codes ready for your products.",
  },
  {
    question: "Do I need an LCA consultant?",
    answer:
      "No. Avelero's LCA engine is designed for product and sustainability teams. You enter your product data and the model predicts your environmental footprint. No environmental science background required.",
  },
];

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
        "Digital product passport platform for fashion brands with an ML-powered footprint prediction engine, API-integrations, and customizable templates.",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
            description="Our LCA engine predicts carbon and water impact from as little as a product category and basic material data. Trained on validated open data sources and ISO 14040-44 methodology, it gives you footprint estimates ready to include in your digital product passports."
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
            href="/passport-designer/"
          />
        </FeatureBlock>
        <ComplianceBlock />
        <FaqBlock items={FAQ_ITEMS} />
        <RelatedUpdates currentSlug="home" />
      </main>
    </>
  );
}

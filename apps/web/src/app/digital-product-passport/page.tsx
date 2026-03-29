import type { Metadata } from "next";
import { HeroImage } from "@/components/hero-image";
import { FeatureCard, FeatureCards } from "@/components/feature-cards";
import { SplitTextBlock } from "@/components/split-text-block";
import { ComplianceBlock } from "@/components/compliance-block";
import { StepCarousel } from "@/components/step-carousel";
import { RelatedUpdates } from "@/components/related-updates";
import { FaqBlock } from "@/components/faq-block";
import { Hero, HeroHeader, HeroLabel, HeroHeadline, HeroAccent, HeroContent } from "@/components/hero";
import { ContactDrawer } from "@/components/contact-drawer";

export const metadata: Metadata = {
  title: "Digital Product Passport",
  description:
    "Create EU-compliant digital product passports that customers actually want to explore. Connect your data, calculate your footprint, design your passport, and go live in days.",
  alternates: {
    canonical: "https://avelero.com/digital-product-passport/",
  },
  openGraph: {
    title: "Digital Product Passport | Avelero",
    description:
      "Create EU-compliant digital product passports that customers actually want to explore. Connect your data, calculate your footprint, design your passport, and go live in days.",
    type: "website",
  },
};

export default function DigitalProductPassportPage() {
  return (
    <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Hero>
        <HeroHeader>
          <HeroLabel>Digital product passport</HeroLabel>
          <HeroHeadline>
            A <HeroAccent>new</HeroAccent> customer touchpoint
          </HeroHeadline>
        </HeroHeader>
        <HeroContent
          description="Create EU-compliant digital product passports that customers actually want to explore. Connect your data, calculate your footprint, design your passport, and go live in days."
        >
          <ContactDrawer />
        </HeroContent>
      </Hero>
      <HeroImage />
      <SplitTextBlock
        title={<>Digital product passports<br />for fashion brands</>}
        description="Avelero turns your product data into EU-compliant digital product passports that customers actually want to explore."
      />
      <FeatureCards>
        <FeatureCard
          title="Share your impact"
          description="Show customers the environmental footprint of every product."
          backgroundImage="/share-your-impact.webp"
        />
        <FeatureCard
          title="Educate your customers"
          description="Turn complex sustainability data into simple, visual explanations anyone can understand."
          backgroundImage="/educate-your-customers.webp"
        />
        <FeatureCard
          title="Attach your certifications"
          description="Display material origins, suppliers, and certifications on the passport."
          backgroundImage="/attach-your-certifications.webp"
        />
      </FeatureCards>
      <ComplianceBlock />
      <StepCarousel
        topTitle="How it works"
        bottomTitle="in four steps"
      />
      <FaqBlock
        items={[
          {
            question: "What is a digital product passport?",
            answer:
              "A digital product passport (DPP) is a product-level digital record that contains information about a product's materials, origin, environmental impact, and end-of-life options. Consumers access it by scanning a QR code on the product label or packaging.",
          },
          {
            question:
              "When are digital product passports mandatory in the EU?",
            answer:
              "The EU's Ecodesign for Sustainable Products Regulation (ESPR) was adopted in 2024. Textile-specific requirements are expected to be adopted in 2027, with an 18-month transition period — meaning brands selling in the EU should be ready by 2028–2029.",
          },
          {
            question:
              "What information does a digital product passport need to contain?",
            answer:
              "A DPP typically includes material composition by weight, country of origin and manufacturing location, carbon footprint per unit (in kg CO₂e), care and repair instructions, recyclability and end-of-life guidance, and relevant certifications or compliance data.",
          },
          {
            question: "Who needs to comply with DPP regulations?",
            answer:
              "Any brand selling products in the EU market must comply — regardless of where the company is headquartered or where the products are manufactured. This includes non-EU brands exporting to European retailers.",
          },
          {
            question:
              "What is the difference between a DPP and a product label?",
            answer:
              "A product label shows static, limited information like size and wash instructions. A digital product passport is a living digital record that can include supply chain data, environmental scores, certifications, care guides, and even resale or recycling options — all accessible via a scannable QR code.",
          },
          {
            question:
              "How do consumers access a digital product passport?",
            answer:
              "By scanning a QR code printed on the product's care label, hangtag, or packaging. The QR code links to a branded web page showing the product's full passport — no app download required.",
          },
          {
            question:
              "What data do I need to create a digital product passport?",
            answer:
              "At minimum, you need material composition, supplier and manufacturing locations, and product weight. For a complete passport, you'll also want environmental impact data (LCA), certifications, and care instructions. Avelero can calculate your footprint and flag any missing data automatically.",
          },
          {
            question:
              "Can I customize how my digital product passport looks?",
            answer:
              "With Avelero, yes. You can customize the layout, colors, typography, and content sections of your passport to match your brand identity. Every passport is an extension of your brand, not a generic compliance page.",
          },
          {
            question: "How much does a digital product passport cost?",
            answer:
              "Costs vary by provider and the number of SKUs you need to cover. Avelero offers plans designed for brands of all sizes — from emerging labels to enterprise catalogs.",
          },
          {
            question:
              "Do digital product passports apply outside the EU?",
            answer:
              "The regulation originates in the EU, but its impact is global. Any company selling into the EU must comply. Additionally, similar regulations are emerging in the UK, France (AGEC/Anti-Waste Law), and other markets — making DPP adoption a future-proof investment regardless of where you sell.",
          },
        ]}
      />
      <RelatedUpdates currentSlug="digital-product-passport" />
    </main>
  );
}

import type { Metadata } from "next";
import { HeroImage } from "@/components/hero-image";
import { FeatureCard, FeatureCards } from "@/components/feature-cards";
import { SplitTextBlock } from "@/components/split-text-block";
import { RelatedUpdates } from "@/components/related-updates";
import { FaqBlock } from "@/components/faq-block";
import {
  Hero,
  HeroHeader,
  HeroLabel,
  HeroHeadline,
  HeroAccent,
  HeroContent,
} from "@/components/hero";
import { ContactDrawer } from "@/components/contact-drawer";

export const metadata: Metadata = {
  title: "Passport Designer — Customize Your Digital Product Passport",
  description:
    "Design digital product passports that match your brand. Avelero's passport designer gives you modular sections, full brand controls, and a visual editor built for product teams.",
  alternates: {
    canonical: "https://avelero.com/passport-designer/",
  },
  openGraph: {
    title: "Passport Designer — Customize Your Digital Product Passport | Avelero",
    description:
      "Design digital product passports that match your brand. Avelero's passport designer gives you modular sections, full brand controls, and a visual editor built for product teams.",
    type: "website",
    images: [
      {
        url: "https://avelero.com/hero-passport-designer.webp",
        width: 1200,
        height: 630,
        alt: "Passport designer interface showing customizable template with modular content sections and brand controls",
      },
    ],
  },
};

const FAQ_ITEMS = [
  {
    question: "Can I fully customize how my passport looks?",
    answer:
      "Yes. You have full control over typography, colors, layout, and content sections. Every passport is designed to match your brand identity, not a generic compliance page.",
  },
  {
    question: "What content sections can I add to a passport?",
    answer:
      "Avelero offers modular sections including material composition, environmental impact, certifications, care and repair guides, brand story blocks, related products, and custom campaign banners. You can rearrange, add, or remove sections freely.",
  },
  {
    question: "Do changes apply to all my products?",
    answer:
      "Yes. When you update your passport design, changes propagate across every product in your catalog automatically. No manual edits per SKU.",
  },
  {
    question: "Do I need design or coding skills?",
    answer:
      "No. The passport designer is a visual editor built for product and brand teams. You configure sections, set brand rules, and preview changes in real time. No code required.",
  },
  {
    question:
      "Can I add interactive elements like care guides or resell options?",
    answer:
      "Yes. You can add interactive buttons for care instructions, repair services, resale marketplaces, newsletter signups, and links back to your store. These give customers a reason to revisit the passport after purchase.",
  },
  {
    question: "How do customers access the passport?",
    answer:
      "Customers scan a QR code on the product's care label, hangtag, or packaging. The QR code links to a branded web page. No app download required.",
  },
  {
    question: "Can I preview changes before publishing?",
    answer:
      "Yes. The designer includes a live preview so you can see exactly how your passport will look on mobile and desktop before going live.",
  },
  {
    question: "Does the passport designer support multiple languages?",
    answer:
      "Avelero supports multi-language passports. You can configure translations for each content section so customers see the passport in their preferred language.",
  },
];

export default function PassportDesignerPage() {
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://avelero.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Passport Designer",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Hero>
        <HeroHeader>
          <HeroLabel>Passport designer</HeroLabel>
          <HeroHeadline>
            Your <HeroAccent>brand,</HeroAccent> your passport
          </HeroHeadline>
        </HeroHeader>
        <HeroContent description="Design digital product passports that look and feel like your brand. Rearrange modular sections, set your own typography and colors, and apply changes across your entire catalog.">
          <ContactDrawer />
        </HeroContent>
      </Hero>
      <HeroImage
        src="/hero-passport-designer.webp"
        alt="Passport designer interface showing customizable template with modular content sections, brand controls, and layout options"
        mobilePosition="99%"
      />
      <SplitTextBlock
        title={
          <>
            Every passport is
            <br />
            an extension of your brand
          </>
        }
        description="No generic compliance pages. Avelero gives you full control over layout, content, and styling, so every passport reflects your identity, not ours."
      />
      <FeatureCards>
        <FeatureCard
          title="Modular sections"
          description="Drag and drop content blocks like materials, certifications, care guides, and story sections. Rearrange freely."
          backgroundImage="/passport-storyblocks.webp"
        />
        <FeatureCard
          title="Brand controls"
          description="Set your own typography, colors, and layout rules. Every passport matches your brand guidelines out of the box."
          backgroundImage="/passport-banner.webp"
        />
        <FeatureCard
          title="Interactive elements"
          description="Add care guides, repair services, resell options, and links back to your store. Give customers a reason to revisit."
          backgroundImage="/passport-buttons.webp"
        />
      </FeatureCards>
      <FaqBlock items={FAQ_ITEMS} />
      <RelatedUpdates currentSlug="passport-designer" />
    </main>
    </>
  );
}

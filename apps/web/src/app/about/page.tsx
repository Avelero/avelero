import { RelatedUpdates } from "@/components/related-updates";
import type { Metadata } from "next";
import { PageImage } from "@/components/page-image";
import { AboutText } from "@/components/about-text";
import { Hero, HeroHeader, HeroLabel, HeroHeadline, HeroAccent } from "@/components/hero";
import about from "../../../public/about.webp";

export const metadata: Metadata = {
  title: "About",
  description: "About Avelero, the story and its people.",
  alternates: {
    canonical: "https://avelero.com/about/",
  },
  openGraph: {
    title: "About | Avelero",
    description: "About Avelero, the story and its people.",
    type: "website",
  },
};

export default async function AboutPage() {
  return (
    <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Hero>
        <HeroHeader>
          <HeroLabel>About</HeroLabel>
          <HeroHeadline>
            <HeroAccent>We care</HeroAccent> about product passpo
            <span className="tracking-wide">rt</span>s
          </HeroHeadline>
        </HeroHeader>
      </Hero>
      <PageImage src={about} alt="About Avelero" />
      <AboutText />
      <RelatedUpdates currentSlug="about" />
    </main>
  );
}

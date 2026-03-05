import { RelatedUpdates } from "@/components/related-updates";
import type { Metadata } from "next";
import { PageImage } from "@/components/page-image";
import { AboutText } from "@/components/about-text";
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
        <div className="w-full pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px] flex flex-col gap-8 md:gap-16">
            <div className="flex flex-col gap-4">
                <h5 className="text-h5 text-foreground/50">About</h5>
                <h1 className="text-[10vw] sm:text-[clamp(3.8rem,9.5vw,4.8rem)] md:text-[clamp(4.8rem,10vw,6.7rem)] lg:text-[clamp(6.7rem,10.5vw,8.625rem)] xl:text-[8.625rem] leading-none text-foreground">
                    <span className="text-primary">We care</span>{" "}
                    about product passpo<span className="tracking-wide">rt</span>s
                </h1>
            </div>
        </div>
        <PageImage src={about} alt="About Avelero" />
        <AboutText />
        <RelatedUpdates currentSlug="about" />
    </main>
  );
}

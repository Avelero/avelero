import { Hero } from "@/components/hero";
import { HeroImage } from "@/components/hero-image";
import { Brands } from "@/components/brands";

export default function Page() {
  return (
    <div className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Hero />
      <HeroImage />
      <Brands />
    </div>
  );
}

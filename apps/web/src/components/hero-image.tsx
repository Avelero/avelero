import Image from "next/image";

export function HeroImage() {
    return (
        <div className="w-full aspect-[3/4] sm:aspect-[7/4] relative">
            <Image 
            src="/hero-image.webp"
            alt="Hero image"
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-[20%_center]"
            />
      </div>
    );
}
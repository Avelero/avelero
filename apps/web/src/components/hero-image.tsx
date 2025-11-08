import Image from "next/image";

export function HeroImage() {
    return (
        <div className="w-full aspect-[3/5] sm:aspect-[7/4] relative">
            <Image 
            src="/hero-image.webp"
            alt="Digital product passport hero image"
            fill
            priority
            quality={90}
            sizes="(max-width: 640px) 300vw,(max-width: 1280px) 90vw, 1150px"
            className="object-cover object-[16%_center]"
            />
      </div>
    );
}
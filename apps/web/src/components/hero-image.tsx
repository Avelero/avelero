import Image from "next/image";

export function HeroImage() {
    return (
        <div className="w-full aspect-[7/4] relative">
            <Image 
            src="/hero-image.webp"
            alt="Hero image"
            fill
            priority
            className="object-cover"
            />
      </div>
    );
}
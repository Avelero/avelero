import Image from "next/image";
import heroImage from "../../public/hero-image.webp";

export function HeroImage() {
  return (
    <div className="w-full py-[45px] sm:py-[62px]">
      <div className="w-full aspect-[3/5] sm:aspect-[7/4] relative">
        <Image
          src={heroImage}
          alt="Digital product passport interface showing sustainable fashion product information with environmental impact data and customizable brand design"
          fill
          priority
          fetchPriority="high"
          placeholder="blur"
          quality={90}
          // Mobile uses a tall aspect ratio (3/5) with object-cover, so the image is
          // effectively zoomed/cropped horizontally. This ~2.91x multiplier matches
          // the crop factor and preserves sharpness without using a blanket 300vw.
          sizes="(max-width: 639px) calc((100vw - 3rem) * 2.91), (max-width: 1279px) calc(100vw - 8rem), 1152px"
          className="object-cover object-[16%_center]"
        />
      </div>
    </div>
  );
}

import Image, { type StaticImageData } from "next/image";

interface PageImageProps {
  src: StaticImageData | string;
  alt: string;
}

export function PageImage({ src, alt }: PageImageProps) {
  return (
    <div className="w-full py-[45px] sm:py-[62px]">
      <div className="relative w-full aspect-[18/10] overflow-hidden rounded-sm">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(max-width: 639px) calc(100vw - 3rem), (max-width: 1279px) calc(100vw - 8rem), 1152px"
          className="object-cover"
          quality={90}
        />
      </div>
    </div>
  );
}

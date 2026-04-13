import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icons } from "@v1/ui/icons";

export function FeatureBlock({
  children,
  id,
}: { children: ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="flex md:flex-row flex-col w-full py-[45px] sm:py-[62px] gap-4 md:gap-8 scroll-mt-20"
    >
      {children}
    </div>
  );
}

export function FeatureBlockContent({
  topTitle,
  bottomTitle,
  description,
  className,
  href,
}: {
  topTitle: string;
  bottomTitle: string;
  description: string;
  className?: string;
  href?: string;
}) {
  return (
    <div
      className={`flex flex-col items-start justify-between flex-1 ${className || ""}`}
    >
      <h4 className="text-h5 w-full md:block hidden">
        <span className="text-foreground">
          {topTitle}
          <br />
        </span>
        <span className="text-muted-foreground">{bottomTitle}</span>
      </h4>
      <div className="flex flex-col gap-4">
        <p className="text-small text-muted-foreground w-full">{description}</p>
        {href && (
          <Link
            href={href}
            className="text-button text-primary hover:text-[#0000D6] transition-all duration-100"
          >
            <span>Learn more</span>
            <Icons.ChevronRight
              size={14}
              className="inline ml-1"
            />
          </Link>
        )}
      </div>
    </div>
  );
}

export function FeatureBlockImage({
  image,
  imageAlt,
  topTitle,
  bottomTitle,
}: { image: string; imageAlt: string; topTitle: string; bottomTitle: string }) {
  return (
    <div className="flex flex-col items-start justify-between w-full md:w-1/2 flex-1 gap-4 md:gap-0">
      <h4 className="text-h6 w-full block md:hidden">
        <span className="text-foreground">
          {topTitle}
          <br />
        </span>
        <span className="text-muted-foreground">{bottomTitle}</span>
      </h4>
      <div className="relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-sm">
        <Image
          src={image}
          alt={imageAlt}
          fill
          loading="lazy"
          sizes="(max-width: 639px) calc(100vw - 3rem), (max-width: 767px) calc(100vw - 8rem), (max-width: 1279px) calc((100vw - 8rem - 2rem) / 2), 560px"
          className="object-cover"
          quality={90}
        />
      </div>
    </div>
  );
}

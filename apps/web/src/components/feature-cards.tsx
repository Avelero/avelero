import { Icons } from "@v1/ui/icons";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";


interface FeatureCardProps {
  title: string;
  description: string;
  backgroundImage: string;
}

export function FeatureCard({
  title,
  description,
  backgroundImage,
}: FeatureCardProps) {
  return (
    <div className="flex flex-col justify-end gap-6 w-[282.66px] flex-shrink-0 lg:w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded">
        <Image
          src={backgroundImage}
          alt={title}
          fill
          loading="lazy"
          sizes="(max-width: 1023px) 283px, (max-width: 1279px) calc((100vw - 8rem - 3rem) / 3), 368px"
          className="object-cover"
          quality={85}
        />
      </div>
      <div className="flex flex-col w-full">
        <h5 className="text-body text-foreground mb-2">{title}</h5>
        <p className="text-small text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface FeatureCardsProps {
  title?: string;
  href?: string;
  children: ReactNode;
}

export function FeatureCards({ title, href, children }: FeatureCardsProps) {
  const showHeader = title && href;

  return (
    <div className="w-full py-[45px] sm:py-[62px]">
      {showHeader && (
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
          <h4 className="text-h6 md:text-h5 text-foreground">{title}</h4>
          <Link
            href={href}
            className="text-button text-foreground hover:opacity-[0.7] transition-all duration-100"
          >
            Learn more <Icons.ChevronRight className="inline size-[14px]" />
          </Link>
        </div>
      )}
      <div className="w-screen -mx-6 sm:-mx-16 lg:mx-0 lg:w-full">
        <div className="flex flex-row overflow-x-auto overflow-y-hidden lg:overflow-x-visible [&::-webkit-scrollbar]:hidden gap-6 px-6 sm:px-16 lg:grid lg:grid-cols-3 lg:px-0">
          {children}
        </div>
      </div>
    </div>
  );
}

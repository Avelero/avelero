import Image from "next/image";
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
    <div className="flex flex-col gap-6 w-[282.66px] flex-shrink-0 lg:w-full justify-between">
        <div className="flex flex-col w-full">
          <h5 className="text-h6 text-foreground mb-2">{title}</h5>
          <p className="text-small text-foreground/50">{description}</p>
        </div>

        <div className="relative aspect-square w-full overflow-hidden">
            <Image
                src={backgroundImage}
                alt="Blue canvas background image"
                fill
                loading="lazy"
                sizes="(max-width: 1024px) 70vw,(max-width: 1280px) 30vw, 370px"
                className="object-cover"
                quality={85}
            />
        </div>
    </div>
  );
}

interface FeatureCardsProps {
  children: ReactNode;
}

export function FeatureCards({ children }: FeatureCardsProps) {
  return (
    <div className="w-screen -mx-6 sm:-mx-16 lg:mx-0 lg:w-full self-start py-[45px] sm:py-[62px] ">
      <div className="flex flex-row overflow-x-auto overflow-y-hidden lg:overflow-x-visible [&::-webkit-scrollbar]:hidden gap-6 px-6 sm:px-16 lg:grid lg:grid-cols-3 lg:px-0">
        {children}
      </div>
    </div>
  );
}

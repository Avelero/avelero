import Image from "next/image";
import type { ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  backgroundImage: string;
  children?: ReactNode;
}

export function FeatureCard({
  title,
  description,
  backgroundImage,
  children,
}: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col w-full">
          <h5 className="text-h6 text-foreground mb-2">{title}</h5>
          <p className="text-small text-foreground/50">{description}</p>
        </div>

        <div className="relative aspect-square w-full overflow-hidden">
            <Image
                src={backgroundImage}
                alt=""
                fill
                className="object-cover"
                quality={90}
            />
            <div className="relative w-full h-full @container">
                {children}
            </div>
        </div>
    </div>
  );
}

interface FeatureCardsProps {
  children: ReactNode;
}

export function FeatureCards({ children }: FeatureCardsProps) {
  return (
    <div className="py-[62px] grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

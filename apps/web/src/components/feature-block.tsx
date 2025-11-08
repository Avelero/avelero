import Image from "next/image";

export function FeatureBlock({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex md:flex-row flex-col w-full py-[45px] sm:py-[62px] gap-4 md:gap-8">
            {children}
        </div>
    );
}

export function FeatureBlockContent({ topTitle, bottomTitle, description, className }: { topTitle: string, bottomTitle: string, description: string, className?: string }) {
    return (
        <div className={`flex flex-col items-start justify-between flex-1 ${className || ''}`}>
            <h4 className="text-h5 w-full md:block hidden">
                <span className="text-foreground">{topTitle}<br /></span>
                <span className="text-foreground/50">{bottomTitle}</span>
            </h4>
            <p className="text-small text-foreground/50 w-full">{description}</p>
        </div>
    );
}

export function FeatureBlockImage({ image, imageAlt, topTitle, bottomTitle }: { image: string, imageAlt: string, topTitle: string, bottomTitle: string }) {
    return (
        <div className="flex flex-col items-start justify-between w-full md:w-1/2 flex-1 gap-4 md:gap-0">
            <h4 className="text-h6 w-full block md:hidden">
                <span className="text-foreground">{topTitle}<br /></span>
                <span className="text-foreground/50">{bottomTitle}</span>
            </h4>
            <div className="relative aspect-square w-full flex-shrink-0 overflow-hidden">
                <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 90vw,(max-width: 768px) 85vw,(max-width: 1280px) 45vw, 559px"
                    className="object-cover"
                    quality={90}
                />
            </div>
        </div>
    );
}

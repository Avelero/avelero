import Image from "next/image";

export function FeatureBlock({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-row w-full py-[62px] gap-8">
            {children}
        </div>
    );
}

export function FeatureBlockContent({ topTitle, bottomTitle, description }: { topTitle: string, bottomTitle: string, description: string }) {
    return (
        <div className="flex flex-col items-start justify-between flex-1">
            <h4 className="text-h5 w-full">
                <span className="text-foreground">{topTitle}<br /></span>
                <span className="text-foreground/50">{bottomTitle}</span>
            </h4>
            <p className="text-small text-foreground/50 w-full">{description}</p>
        </div>
    );
}

export function FeatureBlockImage({ image }: { image: string }) {
    return (
        <div className="relative aspect-square w-1/2 flex-shrink-0 overflow-hidden">
            <Image src={image} alt="" fill className="object-cover" quality={90} />
        </div>
    );
}

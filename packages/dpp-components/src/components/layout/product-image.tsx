/**
 * Product image renderer for the DPP content layout.
 */
import Image from "next/image";

interface Props {
  image: string;
  alt: string;
}

export function ProductImage({ image, alt }: Props) {
  // Reserve intrinsic dimensions to reduce layout shift while keeping responsive scaling.
  // Next.js blocks image optimization for private IPs (security feature)
  // Use unoptimized for local development URLs
  const isLocalDev =
    image?.includes("127.0.0.1") || image?.includes("localhost:");

  return (
    <div className="product__image w-full border-b @3xl:border overflow-hidden">
      {image ? (
        <Image
          src={image}
          alt={alt}
          width={393}
          height={539}
          className="block w-full h-auto object-contain"
          sizes="100vw"
          quality={90}
          loading="lazy"
          unoptimized={isLocalDev}
        />
      ) : (
        <div
          className="flex min-h-[240px] w-full items-center justify-center"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span
            className="type-body-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            No product image available
          </span>
        </div>
      )}
    </div>
  );
}

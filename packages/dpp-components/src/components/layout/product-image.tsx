import Image from "next/image";

interface Props {
  image: string;
  alt: string;
}

export function ProductImage({ image, alt }: Props) {
  // Next.js blocks image optimization for private IPs (security feature)
  // Use unoptimized for local development URLs
  const isLocalDev =
    image?.includes("127.0.0.1") || image?.includes("localhost:");

  return (
    <div
      className="product__image relative w-full border-b @3xl:border overflow-hidden"
      style={{
        aspectRatio: "393 / 539",
      }}
    >
      {image ? (
        <Image
          src={image}
          alt={alt}
          width={393}
          height={539}
          className="absolute top-0 left-0 w-full h-full object-cover"
          loading="lazy"
          unoptimized={isLocalDev}
        />
      ) : (
        <div
          className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
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

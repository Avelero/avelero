import Image from "next/image";
import Link from "next/link";

interface UpdateCardProps {
  slug: string;
  title: string;
  description: string;
  image: string;
  priority?: boolean;
}

export function UpdateCard({
  slug,
  title,
  description,
  image,
  priority = false,
}: UpdateCardProps) {
  return (
    <Link href={`/updates/${slug}/`} className="flex flex-col group">
      {/* Image Container */}
      <div className="relative aspect-[18/10] w-full overflow-hidden rounded-sm mb-6">
        <Image
          src={image}
          alt={title}
          fill
          priority={priority}
          loading={priority ? undefined : "lazy"}
          sizes="(max-width: 767px) calc(100vw - 3rem), (max-width: 1023px) calc((100vw - 8rem - 1.5rem) / 2), (max-width: 1279px) calc((100vw - 8rem - 3rem) / 3), 368px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={85}
        />
      </div>

      {/* Text Content */}
      <div className="flex flex-col">
        <h2 className="text-body sm:text-h6 text-foreground mb-2 group-hover:opacity-[0.9] transition-all duration-150">
          {title}
        </h2>
        <p className="text-small text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
}

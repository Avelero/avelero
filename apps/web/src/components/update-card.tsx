import Image from "next/image";
import Link from "next/link";

interface UpdateCardProps {
  slug: string;
  title: string;
  description: string;
  image: string;
}

export function UpdateCard({
  slug,
  title,
  description,
  image,
}: UpdateCardProps) {
  return (
    <Link href={`/updates/${slug}/`} className="flex flex-col group">
      {/* Image Container */}
      <div className="relative aspect-[18/10] w-full overflow-hidden mb-6">
        <Image
          src={image}
          alt={title}
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={85}
        />
      </div>

      {/* Text Content */}
      <div className="flex flex-col">
        <h2 className="text-h6 text-foreground mb-2 group-hover:text-foreground/70 transition-colors duration-150">
          {title}
        </h2>
        <p className="text-small text-foreground/50 line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
}

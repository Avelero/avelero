import { getAllUpdates } from "@/lib/updates";
import Link from "next/link";
import { UpdateCard } from "./update-card";

interface RelatedUpdatesProps {
  currentSlug: string;
}

export async function RelatedUpdates({ currentSlug }: RelatedUpdatesProps) {
  const allUpdates = await getAllUpdates();

  // Only show if there are 3 or more total updates
  if (allUpdates.length < 3) {
    return null;
  }

  // Get updates excluding the current one, limit to 3
  const otherUpdates = allUpdates
    .filter((update) => update.slug !== currentSlug)
    .slice(0, 3);

  if (otherUpdates.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-[45px] sm:py-[62px]">
      {/* Header with title and link */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-h5 md:text-h4 text-foreground">Updates</h2>
        <Link
          href="/updates/"
          className="text-button text-foreground hover:text-foreground/70 transition-colors duration-150"
        >
          See more →
        </Link>
      </div>

      {/* Updates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {otherUpdates.map((update) => (
          <UpdateCard key={update.slug} {...update} />
        ))}
      </div>
    </section>
  );
}

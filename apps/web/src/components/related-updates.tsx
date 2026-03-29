import type { ReactNode } from "react";
import { getAllUpdates } from "@/lib/updates";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UpdateCard } from "./update-card";

interface RelatedUpdatesProps {
  currentSlug: string;
  title?: ReactNode;
}

export async function RelatedUpdates({ currentSlug, title }: RelatedUpdatesProps) {
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
      <div className="flex items-end justify-between mb-4 sm:mb-8">
        <h2 className={title ? "text-h6" : "text-h6 sm:text-h4"}>
          {title ?? <span className="text-foreground">Updates</span>}
        </h2>
        <Link
          href="/updates/"
          className="text-button text-foreground hover:opacity-[0.7] transition-all duration-100"
        >
          See more <ChevronRight className="inline size-[14px]" />
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

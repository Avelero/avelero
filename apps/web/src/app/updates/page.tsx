import type { Metadata } from "next";
import { getAllUpdates } from "@/lib/updates";
import { UpdateCard } from "@/components/update-card";
import { Headline } from "@/components/headline";

export const metadata: Metadata = {
  title: "Updates",
  description: "Latest news, announcements, and insights from Avelero.",
  openGraph: {
    title: "Updates | Avelero",
    description: "Latest news, announcements, and insights from Avelero.",
    type: "website",
  },
};

export default async function UpdatesPage() {
  const updates = await getAllUpdates();

  return (
    <main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
      <Headline headline="Updates" />
      <div className="w-full py-[45px] sm:py-[62px]">
        {updates.length === 0 ? (
          <p className="text-body text-foreground/50">
            No updates yet. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {updates.map((update) => (
              <UpdateCard key={update.slug} {...update} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

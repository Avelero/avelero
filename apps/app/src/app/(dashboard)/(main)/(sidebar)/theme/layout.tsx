import { Skeleton } from "@v1/ui/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Design | Avelero",
};

/**
 * Skeleton for theme page.
 * Shown during navigation while page prefetches complete.
 */
function ThemePageSkeleton() {
  return (
    <div className="max-w-[700px] w-full">
      <div className="flex flex-col gap-12">
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}

export default function ThemeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex w-full h-full justify-center items-start p-8 overflow-y-auto scrollbar-hide">
        <Suspense fallback={<ThemePageSkeleton />}>{children}</Suspense>
      </div>
    </div>
  );
}

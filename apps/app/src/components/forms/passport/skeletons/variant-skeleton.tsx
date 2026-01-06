"use client";

/**
 * VariantFormSkeleton
 *
 * Loading skeleton for the variant edit page.
 * FLIPPED layout compared to product skeleton:
 * - Narrow sidebar on LEFT
 * - Wide content on RIGHT
 */

import { Skeleton } from "@v1/ui/skeleton";

export function VariantFormSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[924px]">
      {/* Header skeleton */}
      <Skeleton className="h-8 w-48" />

      <div className="flex flex-row gap-6">
        {/* Narrow sidebar skeleton on LEFT */}
        <div className="flex flex-col gap-6 w-full max-w-[300px] shrink-0">
          {/* Product overview card */}
          <Skeleton className="h-[180px] w-full" />
          {/* Variant list */}
          <Skeleton className="h-[320px] w-full" />
        </div>

        {/* Wide content skeleton on RIGHT */}
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
          {/* Disclaimer banner */}
          <Skeleton className="h-[60px] w-full" />
          {/* Basic info block */}
          <Skeleton className="h-[320px] w-full" />
          {/* Environment block */}
          <Skeleton className="h-[187px] w-full" />
          {/* Materials block */}
          <Skeleton className="h-[208px] w-full" />
          {/* Journey block */}
          <Skeleton className="h-[253px] w-full" />
        </div>
      </div>
    </div>
  );
}

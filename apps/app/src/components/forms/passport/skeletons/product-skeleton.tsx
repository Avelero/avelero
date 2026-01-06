"use client";

/**
 * ProductFormSkeleton
 *
 * Loading skeleton for product create and edit forms.
 * Layout: Wide content on LEFT, narrow sidebar on RIGHT.
 */

import { Skeleton } from "@v1/ui/skeleton";

interface ProductFormSkeletonProps {
  title: string;
}

export function ProductFormSkeleton({ title }: ProductFormSkeletonProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[924px]">
      <p className="type-h4 text-primary">{title}</p>
      <div className="flex flex-row gap-6">
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[187px] w-full" />
          <Skeleton className="h-[208px] w-full" />
          <Skeleton className="h-[253px] w-full" />
          <Skeleton className="h-[290px] w-full" />
          <Skeleton className="h-[290px] w-full" />
        </div>
        <div className="flex flex-col gap-6 w-full max-w-[300px]">
          <Skeleton className="h-[102px] w-full" />
          <Skeleton className="h-[210px] w-full" />
        </div>
      </div>
    </div>
  );
}

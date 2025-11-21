"use client";

import { Skeleton } from "@v1/ui/skeleton";

interface PassportSkeletonProps {
  title: string;
}
export function PassportSkeleton({ title }: PassportSkeletonProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[774px]">
      <p className="type-h4 text-primary">{title}</p>
      <div className="flex flex-row gap-6">
        <div className="flex flex-col gap-6 w-full max-w-[500px]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[187px] w-full" />
          <Skeleton className="h-[208px] w-full" />
          <Skeleton className="h-[253px] w-full" />
          <Skeleton className="h-[290px] w-full" />
          <Skeleton className="h-[290px] w-full" />
        </div>
        <div className="flex flex-col gap-6 w-full max-w-[250px]">
          <Skeleton className="h-[102px] w-full" />
          <Skeleton className="h-[210px] w-full" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@v1/ui/skeleton";

interface DataCardProps {
  title: string;
  value: string | number;
}

export function DataCard({ title, value }: DataCardProps) {
  return (
    <div className="flex flex-col border border-border w-full">
      <div className="px-6 pt-6 pb-4 w-full">
        <div className="type-h4 text-primary">{value}</div>
      </div>
      <div className="px-6 pb-6 w-full">
        <div className="type-h6 !font-normal text-secondary">{title}</div>
      </div>
    </div>
  );
}

interface DataCardSkeletonProps {
  title: string;
}

export function DataCardSkeleton({ title }: DataCardSkeletonProps) {
  return (
    <div className="flex flex-col border border-border w-full">
      <div className="px-6 pt-6 pb-4 w-full">
        <Skeleton className="h-[34px] w-1/2" />
      </div>
      <div className="px-6 pb-6 w-full">
        <div className="type-h6 !font-normal text-secondary">{title}</div>
      </div>
    </div>
  );
}

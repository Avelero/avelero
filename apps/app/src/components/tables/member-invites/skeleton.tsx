import { DataTableHeader } from "./table-header";
import { Skeleton } from "@v1/ui/skeleton";

interface Props {
  brandId: string;
}

export function PendingInvitesSkeleton({ brandId }: Props) {
  return (
    <div className="w-full">
      <DataTableHeader brandId={brandId} />
      <div className="divide-y">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="py-3 flex items-center gap-4">
            <Skeleton className="rounded-full w-8 h-8" />
            <div className="flex flex-col gap-2">
              <Skeleton className="w-[200px] h-3" />
              <Skeleton className="w-[150px] h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



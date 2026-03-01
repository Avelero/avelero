import { Button } from "@v1/ui/button";
import { Skeleton } from "@v1/ui/skeleton";

interface BrandsSkeletonProps {
  invitesOnly?: boolean;
}

export function BrandsSkeleton({ invitesOnly = false }: BrandsSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {invitesOnly ? null : (
            <Button
              variant="outline"
              className="!font-medium hover:bg-background hover:cursor-default w-[84px]"
            >
              Brands
            </Button>
          )}
          <Button
            variant={invitesOnly ? "outline" : "ghost"}
            className="!font-medium text-secondary hover:text-primary hover:bg-transparent w-[81px]"
          >
            Invites
          </Button>
        </div>
      </div>
      <div className="w-full h-[261px] p-4 space-y-3 border">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

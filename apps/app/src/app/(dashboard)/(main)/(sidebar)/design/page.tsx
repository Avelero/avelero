import { SetTheme } from "@/components/design/set-theme";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";

export default async function DesignPage() {
  return (
    <div className="w-[500px]">
      <div className="flex flex-col gap-12">
        <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
          <SetTheme />
        </Suspense>
      </div>
    </div>
  );
}

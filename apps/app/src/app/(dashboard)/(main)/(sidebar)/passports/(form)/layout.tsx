import {
  ControlBar,
  ControlBarLeft,
  ControlBarRight,
} from "@/components/control-bar";
import { FormActionsWrapper } from "@/components/forms/passport";
import { PassportFormProvider } from "@/contexts/passport-form-context";
import { Skeleton } from "@v1/ui/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

/**
 * Generic skeleton for passport form pages.
 * Shown during navigation while page prefetches complete.
 */
function PassportFormSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[924px]">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-row gap-6">
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[187px] w-full" />
          <Skeleton className="h-[208px] w-full" />
        </div>
        <div className="flex flex-col gap-6 w-full max-w-[300px]">
          <Skeleton className="h-[102px] w-full" />
          <Skeleton className="h-[210px] w-full" />
        </div>
      </div>
    </div>
  );
}

export default function PassportsFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PassportFormProvider>
      <div className="flex flex-col h-full">
        <ControlBar>
          <ControlBarLeft />
          <ControlBarRight>
            <FormActionsWrapper />
          </ControlBarRight>
        </ControlBar>
        <div
          id="passport-form-scroll-container"
          className="flex w-full h-full justify-center items-start p-12 overflow-y-auto scrollbar-hide"
        >
          <Suspense fallback={<PassportFormSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </PassportFormProvider>
  );
}

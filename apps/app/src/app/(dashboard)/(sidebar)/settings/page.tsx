import { DeleteBrand } from "@/components/settings/delete-brand";
import { SetCountry } from "@/components/settings/set-country";
import { SetEmail } from "@/components/settings/set-email";
import { SetLogo } from "@/components/settings/set-logo";
import { SetName } from "@/components/settings/set-name";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <div className="w-[700px]">
      <div className="flex flex-col gap-12">
        <Suspense fallback={<Skeleton className="h-[102px] w-full"/>}>
          <SetLogo />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[187px] w-full"/>}>
          <SetName />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[207px] w-full"/>}>
          <SetEmail />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[187px] w-full"/>}>
          <SetCountry />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[102px] w-full"/>}>
          <DeleteBrand />
        </Suspense>
      </div>
    </div>
  );
}

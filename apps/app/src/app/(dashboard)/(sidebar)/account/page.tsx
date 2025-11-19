import { DeleteAccount } from "@/components/account/delete-account";
import { SetAvatar } from "@/components/account/set-avatar";
import { SetEmail } from "@/components/account/set-email";
import { SetName } from "@/components/account/set-name";
import { Suspense } from "react";
import { Skeleton } from "@v1/ui/skeleton";

export default function AccountPage() {
  return (
    <div className="w-[700px]">
      <div className="flex flex-col gap-12">
        <Suspense fallback={<Skeleton className="h-[102px] w-full"/>}>
          <SetAvatar />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[187px] w-full"/>}>
          <SetName />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[187px] w-full"/>}>
          <SetEmail />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[102px] w-full"/>}>
          <DeleteAccount />
        </Suspense>
      </div>
    </div>
  );
}

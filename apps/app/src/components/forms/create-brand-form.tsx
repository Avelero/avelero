"use client";

import { getForceSignOutPath } from "@/lib/auth-access";
import { Button } from "@v1/ui/button";
import { Skeleton } from "@v1/ui/skeleton";

export function CreateBrandForm() {
  return (
    <div className="mx-auto w-full  max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Brand creation moved</h6>
        <p className="text-secondary">
          Brand provisioning is now managed by Avelero admins. Ask your workspace
          owner for an invitation.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={() => window.location.assign(getForceSignOutPath())}
      >
        Back
      </Button>
    </div>
  );
}

export function CreateBrandFormSkeleton() {
  return (
    <div className="mx-auto w-full  max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Brand creation moved</h6>
        <p className="text-secondary">
          Brand provisioning is now managed by Avelero admins.
        </p>
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

"use client";

import { useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Icons } from "@v1/ui/icons";
import { Suspense } from "react";
import { AvatarUpload } from "../avatar-upload";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  role?: "owner" | "member" | null;
  canLeave?: boolean;
}

function InnerLogoUpload() {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const brands = (brandsData as Brand[] | undefined) ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  if (!activeBrand) {
    return (
      <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-accent">
        <Icons.UserRound className="text-tertiary" />
      </div>
    );
  }

  return (
    <AvatarUpload
      entity="brand"
      entityId={activeBrand.id}
      avatarUrl={activeBrand.logo_url}
      name={activeBrand.name}
      hue={null}
      size={52}
    />
  );
}

function SetLogo() {
  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Logo</h6>
          <p className="text-secondary">
            Click on the logo on the right to upload your brand image.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-accent">
              <Icons.UserRound className="text-tertiary" />
            </div>
          }
        >
          <InnerLogoUpload />
        </Suspense>
      </div>
    </div>
  );
}

export { SetLogo };

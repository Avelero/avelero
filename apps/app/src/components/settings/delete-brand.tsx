"use client";

import { useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { useState } from "react";
import { DeleteBrandModal } from "../modals/delete-brand-modal";

interface Brand {
  id: string;
  name: string;
  logo_path?: string | null;
  avatar_hue?: number | null;
  country_code?: string | null;
}

function DeleteBrand() {
  const [open, setOpen] = useState(false);
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();

  const brands = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  if (!activeBrand) {
    return null;
  }

  return (
    <div className="flex flex-row p-6 border border-destructive justify-between items-center">
      <div className="flex flex-col gap-2">
        <h6 className="text-foreground">Delete Brand</h6>
        <p className="text-secondary">
          Permanently delete this brand and all associated data.
        </p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Brand
      </Button>
      <DeleteBrandModal
        open={open}
        onOpenChange={setOpen}
        brandId={activeBrand.id}
      />
    </div>
  );
}

export { DeleteBrand };

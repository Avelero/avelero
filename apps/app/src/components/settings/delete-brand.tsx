"use client";

import { useUserBrandsQuery } from "@/hooks/use-brand";
import { useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { useState } from "react";
import { DeleteBrandModal } from "../modals/delete-brand-modal";

function DeleteBrand() {
  const [open, setOpen] = useState(false);
  const { data: brands, isLoading } = useUserBrandsQuery();
  const { data: user } = useUserQuery();

  // During initial load, don't render anything
  if (isLoading || !brands) {
    return null;
  }

  const activeBrand = brands.find((b) => b.id === user?.brand_id);

  // Only show delete button if user is an owner of the active brand
  if (!activeBrand || activeBrand.role !== "owner") {
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

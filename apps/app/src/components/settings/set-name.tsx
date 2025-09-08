"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";

interface Brand {
  id: string;
  name: string;
  logo_path?: string | null;
  avatar_hue?: number | null;
  country_code?: string | null;
}

function SetName() {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const updateBrand = useBrandUpdateMutation();

  const brands = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  const initialNameRef = useRef<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const initial = activeBrand?.name ?? "";
    initialNameRef.current = initial;
    setName(initial);
  }, [activeBrand?.name]);

  const trimmed = name.trim();
  const isDirty = trimmed !== (initialNameRef.current ?? "").trim();
  const isEmpty = trimmed.length === 0;
  const isSaving = updateBrand.status === "pending";

  function handleSave() {
    if (!isDirty || isEmpty || isSaving || !activeBrand) return;
    updateBrand.mutate(
      { id: activeBrand.id, name: trimmed },
      {
        onSuccess: () => {
          initialNameRef.current = trimmed;
          setName(trimmed);
          toast.success("Brand name changed successfully");
        },
        onError: () => {
          toast.error("Action failed, please try again");
        },
      },
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Name</h6>
          <p className="text-secondary">Enter your brand name on the right.</p>
        </div>
        <Input
          placeholder="Brand name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-[250px]"
        />
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={!isDirty || isEmpty || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export { SetName };

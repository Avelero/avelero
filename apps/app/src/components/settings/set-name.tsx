"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";

function SetName() {
  const { data: brands } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const updateBrand = useBrandUpdateMutation();

  const activeBrand = brands?.find((b) => b.id === user?.brand_id);

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
          toast.success("Brand name updated successfully");
        },
        onError: () => {
          toast.error("Failed to update brand name. Please try again.");
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
          disabled={isSaving}
          className="max-w-[250px] disabled:opacity-100 disabled:cursor-text"
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
